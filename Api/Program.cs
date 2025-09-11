using Microsoft.EntityFrameworkCore;
using Npgsql;
using System.ComponentModel.Design;
using System.Text.Json;
using System.Text.Json.Nodes;

var builder = WebApplication.CreateBuilder(args);

// EF Core + Postgres
builder.Services.AddDbContext<AppDb>(opt =>
    opt.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

// Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// CORS (allow Next.js dev server)
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins("http://localhost:3000").AllowAnyHeader().AllowAnyMethod()));

// Add engines
builder.Services.AddScoped<PricingEngine>();
builder.Services.AddScoped<ConstraintEngine>();

var app = builder.Build();
app.UseCors();


if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Endpoints

//List active boats
app.MapGet("/api/boats", async (AppDb db) =>
 Results.Ok(await db.Boats.Where(b => b.IsActive)
 .Select(b => new { b.Slug, b.Name, b.BasePrice })
 .OrderBy(b => b.Name)
 .ToListAsync()));

//Boat config 
app.MapGet("/api/boats/{slug}/config", async (string slug, AppDb db) =>
{
    var sql = "SELECT * FROM v_boat_config WHERE slug = @slug";
    var param = new NpgsqlParameter("slug", slug);
    var row = await db.BoatConfigs.FromSqlRaw(sql, param).SingleOrDefaultAsync();
    return row is null ? Results.NotFound() : Results.Ok(row.AsJson());
});

//Price + save build
app.MapPost("/api/builds", async (
    PriceRequest req,
    AppDb db,
    PricingEngine pricer,
    ConstraintEngine validator) =>
{
    var boat = await db.Boats
    .Include(boat => boat.Categories).ThenInclude(c => c.OptionsGroups).ThenInclude(g => g.Options)
    .FirstOrDefaultAsync(b => b.Slug == req.BoatSlug && b.IsActive);

    if (boat is null) return Results.NotFound(new { message = "Boat not found" });

    var allGroups = boat.Categories.SelectMany(c => c.OptionsGroups).ToList();
    var allOptions = allGroups.SelectMany(g => g.Options).ToDictionary(o => o.id, o => o);
    var selected = (req.SelectedOptions ?? Array.Empty<Guid>()).ToHashSet();

    //Validate per-group min/max
    var err = new List<string>();
    foreach (var g in allGroups)
    {
        var count = g.Options.Count(o => selected.Contains(o.id));
        if (count < g.MinSelect) err.Add($"Group '{g.Name}': at least {g.MinSelect} required");
        if (g.MaxSelect > 0 && count > g.MaxSelect) err.Add($"Group '{g.Name}': most {g.MaxSelect} allowed");
    }
    if (err.Count > 0) return Results.BadRequest(new { errors = err });

    //Constraints
    var constraints = await db.ConstraintRules.Where(r => r.BoatId == boat.Id).ToListAsync();
    var cErrors = validator.CheckRequires(constraints, selected);
    if (cErrors.Count > 0) return Results.BadRequest(new { errors = cErrors });

    //Pricing
    var pricingRules = await db.PricingRules.Where(r => r.BoatId == boat.Id).OrderBy(r => r.ApplyOrder).ToListAsync();
    var price = pricer.Calculate(boat, allOptions, selected, pricingRules);

    //Save build
    var build = new Build
    {
        Id = Guid.NewGuid(),
        BoatId = boat.Id,
        Selections = JsonSerializer.SerializeToNode(selected),
        Subtotal = price.Subtotal,
        Total = price.Total,
        CreatedAt = DateTime.UtcNow
    };
    db.Builds.Add(build);
    await db.SaveChangesAsync();

    return Results.Ok(new
    {
        buildId = build.Id,
        price.Subtotal,
        price.Total,
        selected
    });
});

//Boats
app.MapGet("/api/admin/boats", async (AppDb db) =>
    Results.Ok(await db.Boats.OrderBy(x => x.Name).ToListAsync()));

app.MapPost("/api/admin/boats", async (BoatUpsert dto, AppDb db) =>
{
    var b = new Boat { Id = Guid.NewGuid(), Slug = dto.Slug, Name = dto.Name, BasePrice = dto.BasePrice, ModelYear = dto.ModelYear, IsActive = true };
    db.Boats.Add(b);
    await db.SaveChangesAsync();
    return Results.Created($"/api/admin/boats/{b.Id}", b);
});

app.MapPatch("/api/admin/boats/{id:guid}", async (Guid id, BoatUpsert dto, AppDb db) =>
{
    var b = await db.Boats.FindAsync(id);
    if (b is null) return Results.NotFound();
    b.Slug = dto.Slug;
    b.Name = dto.Name;
    b.BasePrice = dto.BasePrice;
    b.ModelYear = dto.ModelYear;
    await db.SaveChangesAsync();
    return Results.Ok(b);
});

app.MapDelete("/api/admin/boats/{id:guid}", async (Guid id, AppDb db) =>
{
    var b = await db.Boats.FindAsync(id);
    if (b is null) return Results.NotFound();
    db.Boats.Remove(b);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

// Categories
app.MapGet("/api/admin/boats/{boatId:guid}/categories", async (Guid boatId, AppDb db) =>
    Results.Ok(await db.Categories.Where(c => c.BoatId == boatId).OrderBy(c => c.SortOrder).ToListAsync()));

app.MapPost("/api/admin/categories", async (CategoryUpsert dto, AppDb db) =>
{
    var c = new Category { Id = Guid.NewGuid(), BoatId = dto.BoatId, Name = dto.Name, SortOrder = dto.SortOrder, IsRequired = dto.IsRequired };
    db.Categories.Add(c);
    await db.SaveChangesAsync();
    return Results.Created($"/api/admin/categories/{c.Id}", c);
});

app.MapPatch("/api/admin/categories/{id:guid}", async (Guid id, CategoryUpsert dto, AppDb db) =>
{
    var c = await db.Categories.FindAsync(id);
    if (c is null) return Results.NotFound();
    c.BoatId = dto.BoatId;
    c.Name = dto.Name;
    c.SortOrder = dto.SortOrder;
    c.IsRequired = dto.IsRequired;
    await db.SaveChangesAsync();
    return Results.Ok(c);
});

app.MapDelete("/api/admin/categories/{id:guid}", async (Guid id, AppDb db) =>
{
    var c = await db.Categories.FindAsync(id);
    if (c is null) return Results.NotFound();
    db.Categories.Remove(c);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

// Option groups
app.MapGet("/api/admin/categories/{categoryId:guid}/option-groups", async (Guid categoryId, AppDb db) =>
    Results.Ok(await db.OptionGroups.Where(g => g.CategoryId == categoryId).OrderBy(g => g.SortOrder).ToListAsync()));

app.MapPost("/api/admin/option-groups", async (OptionGroupUpsert dto, AppDb db) =>
{
    var g = new OptionGroup
    {
        Id = Guid.NewGuid(),
        CategoryId = dto.CategoryId,
        Name = dto.Name,
        SelectionType = dto.SelectionType,
        MinSelect = dto.MinSelect,
        MaxSelect = dto.MaxSelect,
        SortOrder = dto.SortOrder
    };
    db.OptionGroups.Add(g);
    await db.SaveChangesAsync();
    return Results.Created($"/api/admin/option-groups/{g.Id}", g);
});

app.MapPatch("/api/admin/option-groups/{id:guid}", async (Guid id, OptionGroupUpsert dto, AppDb db) =>
{
    var g = await db.OptionGroups.FindAsync(id);
    if (g is null) return Results.NotFound();
    g.CategoryId = dto.CategoryId;
    g.Name = dto.Name;
    g.SelectionType = dto.SelectionType;
    g.MinSelect = dto.MinSelect;
    g.MaxSelect = dto.MaxSelect;
    g.SortOrder = dto.SortOrder;
    await db.SaveChangesAsync();
    return Results.Ok(g);
});

app.MapDelete("/api/admin/option-groups/{id:guid}", async (Guid id, AppDb db) =>
{
    var g = await db.OptionGroups.FindAsync(id);
    if (g is null) return Results.NotFound();
    db.OptionGroups.Remove(g);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

// Options
app.MapGet("/api/admin/option-groups/{groupId:guid}/options", async (Guid groupId, AppDb db) =>
    Results.Ok(await db.Options.Where(o => o.OptionsGroupId == groupId).ToListAsync()));

app.MapPost("/api/admin/options", async (OptionUpsert dto, AppDb db) =>
{
    var o = new Option
    {
        id = Guid.NewGuid(),
        OptionsGroupId = dto.OptionGroupId,
        Sku = dto.Sku,
        Label = dto.Label,
        Description = dto.Description,
        Price = dto.PriceDelta,
        ImageUrl = dto.ImageUrl,
        IsDefault = dto.IsDefault,
        IsActive = dto.IsActive
    };
    db.Options.Add(o);
    await db.SaveChangesAsync();
    return Results.Created($"/api/admin/options/{o.id}", o);
});

app.MapPatch("/api/admin/options/{id:guid}", async (Guid id, OptionUpsert dto, AppDb db) =>
{
    var o = await db.Options.FindAsync(id);
    if (o is null) return Results.NotFound();
    o.OptionsGroupId = dto.OptionGroupId;
    o.Sku = dto.Sku;
    o.Label = dto.Label;
    o.Description = dto.Description;
    o.Price = dto.PriceDelta;
    o.ImageUrl = dto.ImageUrl;
    o.IsDefault = dto.IsDefault;
    o.IsActive = dto.IsActive;
    await db.SaveChangesAsync();
    return Results.Ok(o);
});

app.MapDelete("/api/admin/options/{id:guid}", async (Guid id, AppDb db) =>
{
    var o = await db.Options.FindAsync(id);
    if (o is null) return Results.NotFound();
    db.Options.Remove(o);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

app.Run();

public record BoatUpsert(string Slug, string Name, decimal BasePrice, int? ModelYear);
public record CategoryUpsert(Guid BoatId, string Name, int SortOrder, bool IsRequired);
public record OptionGroupUpsert(Guid CategoryId, string Name, string SelectionType, int MinSelect, int MaxSelect, int SortOrder);
public record OptionUpsert(Guid OptionGroupId, string? Sku, string Label, string? Description, decimal PriceDelta, string? ImageUrl, bool IsDefault, bool IsActive, int SortOrder);

// Data + EF + Helpers

public class AppDb : DbContext
{
    public AppDb(DbContextOptions<AppDb> o) : base(o) { }

    public DbSet<Boat> Boats => Set<Boat>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<OptionGroup> OptionGroups => Set<OptionGroup>();
    public DbSet<Option> Options => Set<Option>();
    public DbSet<ConstraintRule> ConstraintRules => Set<ConstraintRule>();
    public DbSet<PricingRule> PricingRules => Set<PricingRule>();
    public DbSet<Build> Builds => Set<Build>();

    //keyless entity for boat config view
    public DbSet<BoatConfigRow> BoatConfigs => Set<BoatConfigRow>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Boat>().HasIndex(x => x.Slug).IsUnique();
        b.Entity<Category>().HasOne(x => x.Boat).WithMany(x => x.Categories).HasForeignKey(x => x.BoatId);
        b.Entity<OptionGroup>().HasOne(x => x.Category).WithMany(x => x.OptionsGroups).HasForeignKey(x => x.CategoryId);
        b.Entity<Option>().HasOne(x => x.OptionsGroup).WithMany(x => x.Options).HasForeignKey(x => x.OptionsGroupId);

        //Map keyless entity to view
        b.Entity<BoatConfigRow>().HasNoKey().ToView(null);
    }
}

public class Boat
{
    public Guid Id { get; set; }
    public string Slug { get; set; } = "";
    public string Name { get; set; } = "";
    public decimal BasePrice { get; set; }
    public bool IsActive { get; set; } = true;
    public int? ModelYear { get; set; }
    public string? HeroImageUrl { get; set; }
    public ICollection<Category> Categories { get; set; } = new List<Category>();
}

public class Category
{
    public Guid Id { get; set; }
    public Guid BoatId { get; set; }
    public Boat Boat { get; set; } = default!;
    public string Name { get; set; } = "";
    public int SortOrder { get; set; }
    public bool IsRequired { get; set; }
    public ICollection<OptionGroup> OptionsGroups { get; set; } = new List<OptionGroup>();
}

public class OptionGroup
{
    public Guid Id { get; set; }
    public Guid CategoryId { get; set; }
    public Category Category { get; set; } = default!;
    public string Name { get; set; } = "";
    public string SelectionType { get; set; } = "single"; //single, multi
    public int MinSelect { get; set; }
    public int MaxSelect { get; set; }
    public int SortOrder { get; set; }
    public ICollection<Option> Options { get; set; } = new List<Option>();
}

public class Option
{
    public Guid id { get; set; }
    public Guid OptionsGroupId { get; set; }
    public OptionGroup OptionsGroup { get; set; } = default!;
    public string? Sku { get; set; }
    public string Label { get; set; } = "";
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public string? ImageUrl { get; set; }
    public bool IsDefault { get; set; }
    public bool IsActive { get; set; } = true;
    public JsonNode? Metadata { get; set; }
}

public class ConstraintRule
{
    public Guid Id { get; set; }
    public Guid BoatId { get; set; }
    public string Type { get; set; } = ""; //requires, excludes
    public JsonNode Expression { get; set; } = default!;
    public DateTime CreatedAt { get; set; }
}

public class PricingRule
{
    public Guid Id { get; set; }
    public Guid BoatId { get; set; }
    public string RuleType { get; set; } = ""; //fixed, percent, tiered 
    public JsonNode Expression { get; set; } = default!;
    public decimal Amount { get; set; }
    public int ApplyOrder { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class Build
{
    public Guid Id { get; set; }
    public Guid BoatId { get; set; }
    public JsonNode Selections { get; set; } = default!;
    public decimal Subtotal { get; set; }
    public decimal Total { get; set; }
    public Guid? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class BoatConfigRow
{
    public Guid BoatId { get; set; }
    public string Slug { get; set; } = "";
    public string Name { get; set; } = "";
    public decimal BasePrice { get; set; }
    public JsonNode? categories { get; set; }
    public JsonNode? constraints { get; set; }
    public JsonNode? pricingRules { get; set; }

    public object AsJson() => new
    {
        BoatId,
        Slug,
        Name,
        BasePrice,
        Categories = categories ?? new JsonArray(),
        Constraints = constraints ?? new JsonArray(),
        PricingRules = pricingRules ?? new JsonArray()
    };
}

//Request DTO
public record PriceRequest(string BoatSlug, Guid[]? SelectedOptions);

//Pricing engine: base + options + pricing rules
public class PricingEngine
{
    public PriceResult Calculate(
        Boat boat,
        IDictionary<Guid, Option> allOptions,
        HashSet<Guid> selected,
        IEnumerable<PricingRule> rules)
    {
        var subtotal = boat.BasePrice + selected.Where(allOptions.ContainsKey).Select(id => allOptions[id].Price).DefaultIfEmpty(0m).Sum();

        foreach (var r in rules.Where(r => r.RuleType == "bunldeDiscount"))
        {
            var allOf = r.Expression?["allOf"]?.AsArray()?.Select(n => Guid.Parse(n!.GetValue<string>())).ToHashSet() ?? new HashSet<Guid>();
            if (allOf.Count > 0 && allOf.All(selected.Contains))
            {
                subtotal += r.Amount; //Amount is negative for discount
            }
        }

        return new PriceResult { Subtotal = subtotal, Total = subtotal };
    }
}

public class PriceResult
{
    public decimal Subtotal { get; set; }
    public decimal Total { get; set; }
}

//Constraint engine: requires, excludes
public class ConstraintEngine
{
    public List<string> CheckRequires(IEnumerable<ConstraintRule> rules, HashSet<Guid> selected)
    {
        var errors = new List<string>();
        foreach (var r in rules.Where(r => r.Type == "requires"))
        {
            var ifAny = r.Expression?["ifAny"]?.AsArray()?.Select(n => Guid.Parse(n!.GetValue<string>())).ToHashSet()
                ?? new HashSet<Guid>();
            var thenAny = r.Expression?["thenAny"]?.AsArray()?.Select(n => Guid.Parse(n!.GetValue<string>())).ToHashSet() ?? new HashSet<Guid>();
            if (ifAny.Count == 0 || thenAny.Count == 0) continue;

            var trigger = ifAny.Any(selected.Contains);
            var satisfied = thenAny.Any(selected.Contains);

            if (trigger && !satisfied)
            {
                errors.Add($"Requires one of: {string.Join(", ", thenAny)}");
            }
        }
        return errors;
    }
}
