using Microsoft.EntityFrameworkCore;
using Npgsql.EntityFrameworkCore.PostgreSQL;
using System.Text.Json.Nodes;


// Data + EF + Helpers
public class AppUser
{
    public Guid Id { get; set; }
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string? Username { get; set; }
    public string Role { get; set; } = "user"; //user, admin
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public bool IsActive { get; set; } = true;
}

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

        // Map to exact table names
        b.Entity<AppUser>().ToTable("app_user");
        b.Entity<Boat>().ToTable("boat");
        b.Entity<Category>().ToTable("category");
        b.Entity<OptionGroup>().ToTable("option_group");
        b.Entity<Option>().ToTable("option"); // quoted table in SQL; EF will quote it
        b.Entity<ConstraintRule>().ToTable("constraint_rule");
        b.Entity<PricingRule>().ToTable("pricing_rule");
        b.Entity<Build>().ToTable("build");

        // Column fixes that don't match by name
        b.Entity<Option>().Property(x => x.Price).HasColumnName("price_delta");

        // Optional indexes/relationships
        b.Entity<Boat>().HasIndex(x => x.Slug).IsUnique();
        b.Entity<Category>().HasOne(x => x.Boat).WithMany(x => x.Categories).HasForeignKey(x => x.BoatId);
        b.Entity<OptionGroup>().HasOne(x => x.Category).WithMany(x => x.OptionsGroups).HasForeignKey(x => x.CategoryId);
        b.Entity<Option>().HasOne(x => x.OptionGroup).WithMany(x => x.Options).HasForeignKey(x => x.OptionGroupId);

        // View mapping (keyless). Map column names from v_boat_config.
        b.Entity<BoatConfigRow>().HasNoKey().ToView(null);
        b.Entity<BoatConfigRow>().Property(x => x.BoatId).HasColumnName("boat_id");
        b.Entity<BoatConfigRow>().Property(x => x.BasePrice).HasColumnName("base_price");
        b.Entity<BoatConfigRow>().Property(x => x.categories).HasColumnName("categories");
        b.Entity<BoatConfigRow>().Property(x => x.Constraints).HasColumnName("constraints");
        // In the SQL view, alias ends up lowercase unquoted -> pricingrules
        b.Entity<BoatConfigRow>().Property(x => x.pricingRules).HasColumnName("pricingrules");
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
    public Guid OptionGroupId { get; set; }
    public OptionGroup OptionGroup { get; set; } = default!;
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
    public JsonNode? Constraints { get; set; }
    public JsonNode? pricingRules { get; set; }

    public object AsJson() => new
    {
        BoatId,
        Slug,
        Name,
        BasePrice,
        Categories = categories ?? new JsonArray(),
        Constraints = Constraints ?? new JsonArray(),
        PricingRules = pricingRules ?? new JsonArray()
    };
}



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
