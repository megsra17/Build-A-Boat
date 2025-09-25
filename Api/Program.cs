using Microsoft.EntityFrameworkCore;
using Npgsql;
using System.ComponentModel.Design;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using BCrypt.Net;
using Microsoft.AspNetCore.Identity.Data;

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

//Auth
var jwtSection = builder.Configuration.GetSection("Jwt");
var jwtSecret = jwtSection["Secret"]!;
var jwtKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret));

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSection["Issuer"],
            ValidAudience = jwtSection["Audience"],
            IssuerSigningKey = jwtKey
        };
    });

builder.Services.AddAuthorization(o =>
{
    o.AddPolicy("Admin", p => p.RequireClaim(ClaimTypes.Role, "admin"));
});

var app = builder.Build();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

// Swagger UI
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

var admin = app.MapGroup("/api/admin").RequireAuthorization("Admin");

//Login - issue JWT
app.MapPost("/api/auth/login", async (LoginRequest req, AppDb db) =>
{
    //find user by email
    var email = req.Email.Trim().ToLowerInvariant();

    //app_user table is in DB map quickly via raw query
    var user = await db.Set<AppUser>()
        .FromSqlRaw("SELECT id, email, password_hash, role FROM app_user WHERE email = @email",
            new NpgsqlParameter("email", email))
        .AsNoTracking()
        .SingleOrDefaultAsync();

    if (user is null) return Results.Unauthorized();

    //verify password
    if (!BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash)) return Results.Unauthorized();

    //build JWT
    var jwtSection = app.Configuration.GetSection("Jwt");
    var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSection["Secret"]!));
    var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
    var claims = new[]
    {
        new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
        new Claim(JwtRegisteredClaimNames.Email, user.Email),
        new Claim(ClaimTypes.Role, user.Role)
    };

    var token = new JwtSecurityToken(
        issuer: jwtSection["Issuer"],
        audience: jwtSection["Audience"],
        claims: claims,
        expires: DateTime.UtcNow.AddHours(8),
        signingCredentials: creds
    );

    var jwt = new JwtSecurityTokenHandler().WriteToken(token);

    return Results.Ok(new { token, user = new { user.Id, user.Email, user.Role } });

});

//Forgot password
app.MapPost("api/auth/forgot-password", async (ForgotPasswordRequest req, AppDb db) =>
{
    var email = req.Email.Trim().ToLowerInvariant();
    var user = await db.Set<AppUser>()
    .FromSqlRaw("SELECT id, email, password_hash, role FROM app_user WHERE email = @email",
        new NpgsqlParameter("email", email))
        .AsNoTracking()
        .SingleOrDefaultAsync();

    if (user is null) return Results.Ok(new { message = "If that email is registered, a reset link has been sent." });
    var token = Guid.NewGuid().ToString("N");
    var expiry = DateTime.UtcNow.AddHours(1);

    //save reset token
    await db.Database.ExecuteSqlRawAsync(
        "INSERT INTO password_resets (user_id, token, expires_at) VALUES (@userId, @token, @expiresAt)",
        new NpgsqlParameter("userId", user.Id),
        new NpgsqlParameter("token", token),
        new NpgsqlParameter("expiresAt", expiry)
    );

    //TODO: send email with link (for now just return the token)
    return Results.Ok(new { message = "If that email is registered, a reset link has been sent." });
});

//Reset password
app.MapPost("api/auth/reset-password", async (ResetPasswordRequest req, AppDb db) =>
{
    var reset = await db.Database.SqlQueryRaw<(Guid UserId, DateTime ExpiresAt)>(
         "SELECT user_id, expires_at FROM password_resets WHERE token = @token",
        new NpgsqlParameter("token", req.Token)).FirstOrDefaultAsync();

    if (reset == default || reset.ExpiresAt < DateTime.UtcNow)
        return Results.BadRequest(new { message = "Invalid or expired token" });

    var hash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
    await db.Database.ExecuteSqlRawAsync(
        "UPDATE app_user SET password_hash = @hash WHERE id = @userId",
        new NpgsqlParameter("hash", hash),
        new NpgsqlParameter("userId", reset.UserId)
    );
    await db.Database.ExecuteSqlRawAsync(
        "DELETE FROM password_resets WHERE user_id = @userId",
        new NpgsqlParameter("userId", reset.UserId)
    );
    return Results.Ok(new { message = "Password has been reset" });
});

//List active boats
app.MapGet("/api/boats", async (AppDb db) =>
 Results.Ok(await db.Boats.Where(b => b.IsActive)
 .Select(b => new { b.Slug, b.Name, b.BasePrice })
 .OrderBy(b => b.Name)
 .ToListAsync()));

//List roles
admin.MapGet("/api/roles", async (HttpRequest http, AppDb db) =>
{
    var search = http.Query["search"].ToString()?.Trim().ToLower();
    var q = db.Roles.AsNoTracking();
    if (!string.IsNullOrEmpty(search))
        q = q.Where(r => r.Name.ToLower().Contains(search) || r.Slug.ToLower().Contains(search));

    var items = await q.OrderBy(r => r.Name).ToListAsync();
    return Results.Ok(new { items });
});

//Create role
admin.MapPost("/api/roles", async (RoleUpsert dto, AppDb db) =>
{
    var name = dto.Name.Trim();
    var slug = (dto.Slug ?? dto.Name).Trim().ToLower().Replace(" ", "-");

    var exists = await db.Roles.AnyAsync(r => r.Name == name || r.Slug == slug);
    if (exists) return Results.Conflict(new { message = "Role with same name or slug already exists" });

    var r = new AppRole
    {
        Id = Guid.NewGuid(),
        Name = name,
        Slug = slug,
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow
    };
    db.Roles.Add(r);
    await db.SaveChangesAsync();
    return Results.Created($"/api/admin/roles/{r.Id}", r);
});

//Update role
admin.MapPatch("/api/roles/{id:guid}", async (Guid id, RoleUpsert dto, AppDb db) =>
{
    var r = await db.Roles.FindAsync(id);
    if (r is null) return Results.NotFound();

    r.Name = dto.Name.Trim();
    if (!string.IsNullOrWhiteSpace(dto.Slug))
        r.Slug = dto.Slug.Trim().ToLower().Replace(" ", "-");

    r.UpdatedAt = DateTime.UtcNow;
    await db.SaveChangesAsync();
    return Results.Ok(r);
});

//Delete role
admin.MapDelete("/api/roles/{id:guid}", async (Guid id, AppDb db) =>
{
    var r = await db.Roles.FindAsync(id);
    if (r is null) return Results.NotFound();

    db.Roles.Remove(r);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

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

//Users
admin.MapGet("/users/count", async (AppDb db) =>
{
    var count = await db.Set<AppUser>().CountAsync(u => u.IsActive);
    return Results.Ok(new { count });
});

//User list with paging
admin.MapGet("/users", async (HttpRequest http, AppDb db) =>
{
    //query params
    var q = http.Query;
    var search = q["search"].ToString()?.Trim();
    int page = int.TryParse(q["page"], out var p) ? Math.Max(1, p) : p;
    int pageSize = int.TryParse(q["pageSize"], out var s) ? Math.Clamp(s, 1, 100) : 25;

    var qry = db.Set<AppUser>().AsNoTracking();

    if (!string.IsNullOrEmpty(search))
    {
        var sterm = search.ToLower();
        qry = qry.Where(u => u.Email.ToLower().Contains(sterm) || (u.Username != null && u.Username.ToLower().Contains(sterm)));
    }

    var total = await qry.CountAsync();

    var items = await qry
        .OrderBy(u => u.Email)
        .Skip((page - 1) * pageSize)
        .Take(pageSize)
        .Select(u => new UserListItem(u.Id, u.Email, u.Username, u.Role, u.CreatedAt, u.UpdatedAt))
        .ToListAsync();

    return Results.Ok(new { total, page, pageSize, items });
});

//Create user
admin.MapPost("/users", async (UpsertUser dto, AppDb db) =>
{
    var exists = await db.Set<AppUser>().AnyAsync(u => u.Email == dto.Email);
    if (exists) return Results.Conflict(new { message = "Email already in use" });

    var u = new AppUser
    {
        Id = Guid.NewGuid(),
        Email = dto.Email,
        Username = dto.Username,
        Role = string.IsNullOrEmpty(dto.Role) ? "user" : dto.Role,
        PasswordHash = string.IsNullOrEmpty(dto.Password) ? "" : BCrypt.Net.BCrypt.HashPassword(dto.Password),
        FirstName = dto.FirstName?.Trim(),
        LastName = dto.LastName?.Trim(),
        Timezone = dto.Timezone?.Trim(),
        AvatarUrl = dto.AvatarUrl?.Trim(),
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow,
    };
    db.Add(u);
    await db.SaveChangesAsync();
    return Results.Created($"/api/admin/users/{u.Id}", new { u.Id });
});

//Update user
admin.MapPatch("users/{id:guid}", async (Guid id, UpsertUser dto, AppDb db) =>
{
    var u = await db.Set<AppUser>().FindAsync(id);
    if (u is null) return Results.NotFound();

    if (!string.IsNullOrWhiteSpace(dto.Email) && dto.Email != u.Email)
    {
        var exists = await db.Set<AppUser>().AnyAsync(x => x.Email == dto.Email && x.Id != id);
        if (exists) return Results.Conflict(new { message = "Email already in use" });
        u.Email = dto.Email.Trim().ToLowerInvariant();
    }

    u.Username = dto.Username?.Trim() ?? u.Username;
    u.Role = string.IsNullOrWhiteSpace(dto.Role) ? u.Role : dto.Role;
    if (!string.IsNullOrWhiteSpace(dto.Password))
        u.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);

    u.FirstName = dto.FirstName?.Trim() ?? u.FirstName;
    u.LastName = dto.LastName?.Trim() ?? u.LastName;
    u.Timezone = dto.Timezone?.Trim() ?? u.Timezone;
    u.AvatarUrl = dto.AvatarUrl?.Trim() ?? u.AvatarUrl;

    u.UpdatedAt = DateTime.UtcNow;
    await db.SaveChangesAsync();
    return Results.Ok(new { u.Id });
});

//Delete user
admin.MapDelete("/users/{id:guid}", async (Guid id, AppDb db) =>
{
    var u = await db.Set<AppUser>().FindAsync(id);
    if (u is null) return Results.NotFound();
    db.Remove(u);
    await db.SaveChangesAsync();
    return Results.NoContent();
});


//Boats
admin.MapGet("/boats", async (AppDb db) =>
            Results.Ok(await db.Boats.OrderBy(x => x.Name).ToListAsync()));

//Create boat
admin.MapPost("/boats", async (BoatUpsert dto, AppDb db) =>
{
    var b = new Boat { Id = Guid.NewGuid(), Slug = dto.Slug, Name = dto.Name, BasePrice = dto.BasePrice, ModelYear = dto.ModelYear, IsActive = true };
    db.Boats.Add(b);
    await db.SaveChangesAsync();
    return Results.Created($"/api/admin/boats/{b.Id}", b);
});

//Update boat
admin.MapPatch("/boats/{id:guid}", async (Guid id, BoatUpsert dto, AppDb db) =>
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

//Delete boat
admin.MapDelete("/boats/{id:guid}", async (Guid id, AppDb db) =>
{
    var b = await db.Boats.FindAsync(id);
    if (b is null) return Results.NotFound();
    db.Boats.Remove(b);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

// Categories
admin.MapGet("/boats/{boatId:guid}/categories", async (Guid boatId, AppDb db) =>
    Results.Ok(await db.Categories.Where(c => c.BoatId == boatId).OrderBy(c => c.SortOrder).ToListAsync()));

// Create category
admin.MapPost("/categories", async (CategoryUpsert dto, AppDb db) =>
{
    var c = new Category { Id = Guid.NewGuid(), BoatId = dto.BoatId, Name = dto.Name, SortOrder = dto.SortOrder, IsRequired = dto.IsRequired };
    db.Categories.Add(c);
    await db.SaveChangesAsync();
    return Results.Created($"/api/admin/categories/{c.Id}", c);
});

//
admin.MapPatch("/categories/{id:guid}", async (Guid id, CategoryUpsert dto, AppDb db) =>
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

// Delete category
admin.MapDelete("/categories/{id:guid}", async (Guid id, AppDb db) =>
{
    var c = await db.Categories.FindAsync(id);
    if (c is null) return Results.NotFound();
    db.Categories.Remove(c);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

// Option groups
admin.MapGet("/categories/{categoryId:guid}/option-groups", async (Guid categoryId, AppDb db) =>
    Results.Ok(await db.OptionGroups.Where(g => g.CategoryId == categoryId).OrderBy(g => g.SortOrder).ToListAsync()));

// Create option group
admin.MapPost("/option-groups", async (OptionGroupUpsert dto, AppDb db) =>
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

// Update option group
admin.MapPatch("/option-groups/{id:guid}", async (Guid id, OptionGroupUpsert dto, AppDb db) =>
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

// Delete option group
admin.MapDelete("/option-groups/{id:guid}", async (Guid id, AppDb db) =>
{
    var g = await db.OptionGroups.FindAsync(id);
    if (g is null) return Results.NotFound();
    db.OptionGroups.Remove(g);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

// Options
admin.MapGet("/option-groups/{groupId:guid}/options", async (Guid groupId, AppDb db) =>
    Results.Ok(await db.Options.Where(o => o.OptionGroupId == groupId).ToListAsync()));

// Create option
admin.MapPost("/options", async (OptionUpsert dto, AppDb db) =>
{
    var o = new Option
    {
        id = Guid.NewGuid(),
        OptionGroupId = dto.OptionGroupId,
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

// Update option
admin.MapPatch("/options/{id:guid}", async (Guid id, OptionUpsert dto, AppDb db) =>
{
    var o = await db.Options.FindAsync(id);
    if (o is null) return Results.NotFound();
    o.OptionGroupId = dto.OptionGroupId;
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

// Delete option
admin.MapDelete("/options/{id:guid}", async (Guid id, AppDb db) =>
{
    var o = await db.Options.FindAsync(id);
    if (o is null) return Results.NotFound();
    db.Options.Remove(o);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

app.Run();