using Microsoft.EntityFrameworkCore;
using Npgsql.EntityFrameworkCore.PostgreSQL;
using System.Text.Json.Nodes;
using System.Text.Json;



// Data + EF + Helpers
public class AppUser
{
    public Guid Id { get; set; }
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string? Username { get; set; }
    public string Role { get; set; } = "user"; //user, admin
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Timezone { get; set; }
    public string? AvatarUrl { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public bool IsActive { get; set; } = true;
}

public class AppDb : DbContext
{
    public AppDb(DbContextOptions<AppDb> o) : base(o) { }

    public DbSet<AppRole> Roles => Set<AppRole>();
    public DbSet<Boat> Boats => Set<Boat>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<OptionGroup> OptionGroups => Set<OptionGroup>();
    public DbSet<Option> Options => Set<Option>();
    public DbSet<ConstraintRule> ConstraintRules => Set<ConstraintRule>();
    public DbSet<PricingRule> PricingRules => Set<PricingRule>();
    public DbSet<Build> Builds => Set<Build>();
    public DbSet<Media> Media => Set<Media>();
    public DbSet<BoatLayerMedia> BoatLayerMedias => Set<BoatLayerMedia>();

    public DbSet<AppSettings> Settings => Set<AppSettings>();

    //keyless entity for boat config view
    public DbSet<BoatConfigRow> BoatConfigs => Set<BoatConfigRow>();

    protected override void OnModelCreating(ModelBuilder b)
    {

        // Map to exact table names
        b.Entity<AppUser>().ToTable("app_user");
        b.Entity<AppUser>().Property(x => x.Id).HasColumnName("id");
        b.Entity<AppUser>().Property(x => x.Email).HasColumnName("email");
        b.Entity<AppUser>().Property(x => x.PasswordHash).HasColumnName("password_hash");
        b.Entity<AppUser>().Property(x => x.Role).HasColumnName("role");
        b.Entity<AppUser>().Property(x => x.Username).HasColumnName("username");
        b.Entity<AppUser>().Property(x => x.FirstName).HasColumnName("first_name");
        b.Entity<AppUser>().Property(x => x.LastName).HasColumnName("last_name");
        b.Entity<AppUser>().Property(x => x.Timezone).HasColumnName("timezone");
        b.Entity<AppUser>().Property(x => x.AvatarUrl).HasColumnName("avatar_url");
        b.Entity<AppUser>().Property(x => x.CreatedAt).HasColumnName("created_at");
        b.Entity<AppUser>().Property(x => x.UpdatedAt).HasColumnName("updated_at");
        b.Entity<AppUser>().Property(x => x.IsActive).HasColumnName("is_active");

        b.Entity<AppRole>().ToTable("app_role");
        b.Entity<AppRole>().Property(x => x.Id).HasColumnName("id");
        b.Entity<AppRole>().Property(x => x.Name).HasColumnName("name");
        b.Entity<AppRole>().Property(x => x.Slug).HasColumnName("slug");
        b.Entity<AppRole>().Property(x => x.CreatedAt).HasColumnName("created_at");
        b.Entity<AppRole>().Property(x => x.UpdatedAt).HasColumnName("updated_at");
        b.Entity<AppRole>().HasIndex(x => x.Slug).IsUnique();

        b.Entity<AppSettings>().ToTable("app_settings");
        b.Entity<AppSettings>().HasKey(x => x.key);
        b.Entity<AppSettings>().Property(x => x.updatedAt).HasColumnName("updated_at");

        b.Entity<Boat>().ToTable("boat");
        b.Entity<Boat>().Property(x => x.Id).HasColumnName("id");
        b.Entity<Boat>().Property(x => x.Slug).HasColumnName("slug");
        b.Entity<Boat>().Property(x => x.Name).HasColumnName("name");
        b.Entity<Boat>().Property(x => x.BasePrice).HasColumnName("base_price");
        b.Entity<Boat>().Property(x => x.IsActive).HasColumnName("is_active");
        b.Entity<Boat>().Property(x => x.ModelYear).HasColumnName("model_year");
        b.Entity<Boat>().Property(x => x.HeroImageUrl).HasColumnName("hero_image_url");
        // Configure the new columns that were added to the database
        b.Entity<Boat>().Property(x => x.Features)
            .HasColumnName("features")
            .HasColumnType("jsonb");
        b.Entity<Boat>().Property(x => x.PrimaryImageUrl).HasColumnName("primary_image_url");
        b.Entity<Boat>().Property(x => x.SecondaryImageUrl).HasColumnName("secondary_image_url");
        b.Entity<Boat>().Property(x => x.SideImageUrl).HasColumnName("side_image_url");
        b.Entity<Boat>().Property(x => x.LogoImageUrl).HasColumnName("logo_image_url");
        b.Entity<Category>().ToTable("category");
        b.Entity<Category>().Property(x => x.Id).HasColumnName("id");
        b.Entity<Category>().Property(x => x.BoatId).HasColumnName("boat_id");
        b.Entity<Category>().Property(x => x.Name).HasColumnName("name");
        b.Entity<Category>().Property(x => x.SortOrder).HasColumnName("sort_order");
        b.Entity<Category>().Property(x => x.IsRequired).HasColumnName("is_required");
        b.Entity<OptionGroup>().ToTable("option_group");
        b.Entity<Option>().ToTable("option"); // quoted table in SQL; EF will quote it
        b.Entity<ConstraintRule>().ToTable("constraint_rule");
        b.Entity<PricingRule>().ToTable("pricing_rule");
        b.Entity<Build>().ToTable("build");
        b.Entity<Media>().ToTable("media");
        b.Entity<BoatLayerMedia>().ToTable("boat_layer_media");

        // Column fixes that don't match by name
        b.Entity<Option>().Property(x => x.Price).HasColumnName("price_delta");

        // Media entity configuration
        b.Entity<Media>().Property(x => x.Id).HasColumnName("id");
        b.Entity<Media>().Property(x => x.Url).HasColumnName("url").HasColumnType("text");
        b.Entity<Media>().Property(x => x.Label).HasColumnName("label").HasColumnType("varchar(255)");
        b.Entity<Media>().Property(x => x.FileName).HasColumnName("file_name").HasColumnType("varchar(255)");
        b.Entity<Media>().Property(x => x.ContentType).HasColumnName("content_type").HasColumnType("varchar(255)");
        b.Entity<Media>().Property(x => x.UploadedAt).HasColumnName("uploaded_at").HasColumnType("timestamp");
        b.Entity<Media>().Property(x => x.W).HasColumnName("w");
        b.Entity<Media>().Property(x => x.H).HasColumnName("h");

        // BoatLayerMedia entity configuration (composite key)
        b.Entity<BoatLayerMedia>().HasKey(x => new { x.BoatId, x.MediaId });
        b.Entity<BoatLayerMedia>().Property(x => x.BoatId).HasColumnName("boat_id");
        b.Entity<BoatLayerMedia>().Property(x => x.MediaId).HasColumnName("media_id");
        b.Entity<BoatLayerMedia>().Property(x => x.SortOrder).HasColumnName("sort_order");

        // Optional indexes/relationships
        b.Entity<Boat>().HasIndex(x => x.Slug).IsUnique();
        b.Entity<Category>().HasOne(x => x.Boat).WithMany(x => x.Categories).HasForeignKey(x => x.BoatId);
        b.Entity<OptionGroup>().HasOne(x => x.Category).WithMany(x => x.OptionsGroups).HasForeignKey(x => x.CategoryId);
        b.Entity<Option>().HasOne(x => x.OptionGroup).WithMany(x => x.Options).HasForeignKey(x => x.OptionGroupId);

        // View mapping (keyless). Map column names from v_boat_config.
        b.Entity<BoatConfigRow>().HasNoKey().ToView(null);

        // Column name mappings
        b.Entity<BoatConfigRow>().Property(x => x.BoatId).HasColumnName("boat_id");
        b.Entity<BoatConfigRow>().Property(x => x.BasePrice).HasColumnName("base_price");
        b.Entity<BoatConfigRow>().Property(x => x.Categories)
        .HasColumnName("category")
        .HasColumnType("jsonb");
        b.Entity<BoatConfigRow>().Property(x => x.Constraints)
            .HasColumnName("constraints")
            .HasColumnType("jsonb");
        b.Entity<BoatConfigRow>().Property(x => x.PricingRules)
            .HasColumnName("pricingrules")
            .HasColumnType("jsonb");
    }
}

public class AppRole
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string Slug { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class AppSettings
{
    public string key { get; set; } = "";
    public string value { get; set; } = "";
    public DateTime updatedAt { get; set; }
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
    public string? Features { get; set; }
    public string? PrimaryImageUrl { get; set; }
    public string? SecondaryImageUrl { get; set; }
    public string? SideImageUrl { get; set; }
    public string? LogoImageUrl { get; set; }
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

public class BoatLayerMedia
{
    public Guid BoatId { get; set; }
    public Guid MediaId { get; set; }
    public int SortOrder { get; set; }
}

public class Media
{
    public Guid Id { get; set; }
    public string Url { get; set; } = default!;
    public string? Label { get; set; }
    public string? FileName { get; set; }
    public string? ContentType { get; set; }
    public DateTime? UploadedAt { get; set; }
    public int? W { get; set; }
    public int? H { get; set; }
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
    public JsonDocument? Metadata { get; set; }
}

public class ConstraintRule
{
    public Guid Id { get; set; }
    public Guid BoatId { get; set; }
    public string Type { get; set; } = ""; //requires, excludes
    public JsonDocument Expression { get; set; } = default!;
    public DateTime CreatedAt { get; set; }
}

public class PricingRule
{
    public Guid Id { get; set; }
    public Guid BoatId { get; set; }
    public string RuleType { get; set; } = ""; //fixed, percent, tiered 
    public JsonDocument Expression { get; set; } = default!;
    public decimal Amount { get; set; }
    public int ApplyOrder { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class Build
{
    public Guid Id { get; set; }
    public Guid BoatId { get; set; }
    public JsonDocument Selections { get; set; } = default!;
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
    public JsonDocument? Categories { get; set; }
    public JsonDocument? Constraints { get; set; }
    public JsonDocument? PricingRules { get; set; }

    public object AsJson()
    {
        //Return as JSON object, with empty arrays if null
        static JsonElement EmptyArray() => JsonDocument.Parse("[]").RootElement;

        return new
        {
            BoatId,
            Slug,
            Name,
            BasePrice,
            Categories = Categories?.RootElement ?? EmptyArray(),
            Constraints = Constraints?.RootElement ?? EmptyArray(),
            PricingRules = PricingRules?.RootElement ?? EmptyArray()
        };
    }
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
            var allOf = new HashSet<Guid>();
            if (r.Expression.RootElement.TryGetProperty("allOf", out var allOfElement))
            {
                allOf = allOfElement.EnumerateArray().Select(n => Guid.Parse(n.GetString()!)).ToHashSet();
            }
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
            var ifAny = new HashSet<Guid>();
            var thenAny = new HashSet<Guid>();

            if (r.Expression.RootElement.TryGetProperty("ifAny", out var ifAnyElement))
            {
                ifAny = ifAnyElement.EnumerateArray().Select(n => Guid.Parse(n.GetString()!)).ToHashSet();
            }

            if (r.Expression.RootElement.TryGetProperty("thenAny", out var thenAnyElement))
            {
                thenAny = thenAnyElement.EnumerateArray().Select(n => Guid.Parse(n.GetString()!)).ToHashSet();
            }
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

// Email service interface
public interface IEmailService
{
    Task SendPasswordResetEmailAsync(string toEmail, string resetToken);
}

// Simple email service implementation
public class EmailService : IEmailService
{
    private readonly IConfiguration _config;

    public EmailService(IConfiguration config)
    {
        _config = config;
    }

    public async Task SendPasswordResetEmailAsync(string toEmail, string resetToken)
    {
        try
        {
            // For now, just log the email details
            // In production, you'd implement actual email sending
            Console.WriteLine($"[EMAIL] Would send password reset email to: {toEmail}");
            Console.WriteLine($"[EMAIL] Reset token: {resetToken}");
            Console.WriteLine($"[EMAIL] Reset link: https://build-a-boat.vercel.app/admin/reset-password?token={resetToken}");

            // TODO: Implement actual email sending with SMTP, SendGrid, etc.
            // Example with SMTP (requires MailKit NuGet package):
            /*
            using var client = new SmtpClient();
            await client.ConnectAsync(_config["Email:SmtpHost"], int.Parse(_config["Email:SmtpPort"]), true);
            await client.AuthenticateAsync(_config["Email:SmtpUser"], _config["Email:SmtpPassword"]);
            
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress("Build-A-Boat", _config["Email:FromAddress"]));
            message.To.Add(new MailboxAddress("", toEmail));
            message.Subject = "Reset Your Password";
            message.Body = new TextPart("html")
            {
                Text = $@"
                    <h2>Reset Your Password</h2>
                    <p>Click the link below to reset your password:</p>
                    <a href='https://build-a-boat.vercel.app/admin/reset-password?token={resetToken}'>Reset Password</a>
                    <p>This link will expire in 1 hour.</p>
                "
            };
            
            await client.SendAsync(message);
            await client.DisconnectAsync(true);
            */

            await Task.CompletedTask; // Placeholder for async operation
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[EMAIL ERROR] Failed to send email: {ex.Message}");
            throw;
        }
    }
}