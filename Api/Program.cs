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
using DotNetEnv;
using Amazon.S3;
using Amazon.Extensions.NETCore.Setup;

var builder = WebApplication.CreateBuilder(args);

//load .env in development
if (builder.Environment.IsDevelopment())
{
    Env.Load();
}

// EF Core + Postgres
builder.Services.AddDbContext<AppDb>(opt =>
{
    var connectionString = Environment.GetEnvironmentVariable("DATABASE_URL")
        ?? builder.Configuration.GetConnectionString("Default");

    Console.WriteLine($"Raw connection string: {connectionString}");
    Console.WriteLine($"Environment: {builder.Environment.EnvironmentName}");
    Console.WriteLine($"PORT: {Environment.GetEnvironmentVariable("PORT")}");

    if (string.IsNullOrEmpty(connectionString) || connectionString == "placeholder")
    {
        Console.WriteLine("ERROR: No valid database connection string found!");
        throw new InvalidOperationException("DATABASE_URL environment variable is required");
    }

    // Convert Railway DATABASE_URL format to Entity Framework format if needed
    if (connectionString.StartsWith("postgresql://"))
    {
        try
        {
            var uri = new Uri(connectionString);
            var host = uri.Host;
            var port = uri.Port;
            var database = uri.LocalPath.TrimStart('/');
            var username = uri.UserInfo.Split(':')[0];
            var password = uri.UserInfo.Split(':')[1];

            // Set individual PostgreSQL environment variables that Railway expects
            Environment.SetEnvironmentVariable("PGHOST", host);
            Environment.SetEnvironmentVariable("PGPORT", port.ToString());
            Environment.SetEnvironmentVariable("PGDATABASE", database);
            Environment.SetEnvironmentVariable("PGUSER", username);
            Environment.SetEnvironmentVariable("PGPASSWORD", password);

            connectionString = $"Host={host};Port={port};Database={database};Username={username};Password={password}";
            Console.WriteLine($"Converted connection string: Host={host};Port={port};Database={database};Username={username};Password=***");
            Console.WriteLine($"Set PGHOST={host}, PGPORT={port}, PGDATABASE={database}, PGUSER={username}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error converting connection string: {ex.Message}");
            throw;
        }
    }

    opt.UseNpgsql(connectionString);
});// Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// CORS (allow Next.js dev server and Vercel deployment)
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
{
    var origins = new List<string>
    {
        "http://localhost:3000",
        "https://build-a-boat.vercel.app"
    };

    // Add any Vercel preview URLs
    var vercelUrl = Environment.GetEnvironmentVariable("VERCEL_URL");
    if (!string.IsNullOrEmpty(vercelUrl))
    {
        origins.Add($"https://{vercelUrl}");
    }

    p.WithOrigins(origins.ToArray()).AllowAnyHeader().AllowAnyMethod();
}));

// Add engines
builder.Services.AddScoped<PricingEngine>();
builder.Services.AddScoped<ConstraintEngine>();

// Add email service
builder.Services.AddScoped<IEmailService, EmailService>();

// Add AWS S3 service
builder.Services.AddAWSService<IAmazonS3>();
builder.Services.AddScoped<IS3Service, S3Service>();

// Configure JSON serialization to handle circular references
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
});

//Auth
var jwtSection = builder.Configuration.GetSection("Jwt");
var jwtSecret = Environment.GetEnvironmentVariable("JWT_SECRET") ?? jwtSection["Secret"];
var jwtIssuer = Environment.GetEnvironmentVariable("JWT_ISSUER") ?? jwtSection["Issuer"];
var jwtAudience = Environment.GetEnvironmentVariable("JWT_AUDIENCE") ?? jwtSection["Audience"];

Console.WriteLine($"JWT Secret set: {!string.IsNullOrEmpty(jwtSecret)}");
Console.WriteLine($"JWT Issuer: {jwtIssuer}");
Console.WriteLine($"JWT Audience: {jwtAudience}");

if (string.IsNullOrEmpty(jwtSecret))
{
    Console.WriteLine("ERROR: JWT_SECRET is required but not set!");
    throw new InvalidOperationException("JWT_SECRET environment variable is required");
}

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
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = jwtKey
        };
    });

builder.Services.AddAuthorization(o =>
{
    o.AddPolicy("Admin", p => p.RequireClaim(ClaimTypes.Role, "admin"));
});

var app = builder.Build();

// Apply database migrations
try
{
    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<AppDb>();

        var connection = db.Database.GetDbConnection();
        await connection.OpenAsync();

        // Check if group table exists, if not create it
        using (var command = connection.CreateCommand())
        {
            command.CommandText = @"
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_name = 'group'
                )";
            var result = await command.ExecuteScalarAsync();
            if (result is false)
            {
                Console.WriteLine("Creating group table...");
                command.CommandText = @"
                    CREATE TABLE ""group"" (
                        id uuid PRIMARY KEY,
                        boat_id uuid NOT NULL REFERENCES boat(id) ON DELETE CASCADE,
                        name varchar(255) NOT NULL,
                        sort_order integer NOT NULL,
                        CONSTRAINT fk_group_boat_id FOREIGN KEY (boat_id) REFERENCES boat(id) ON DELETE CASCADE
                    );";
                await command.ExecuteNonQueryAsync();
                Console.WriteLine("Group table created successfully");
            }
        }

        // Check if group_id column exists in category table, if not add it
        using (var command = connection.CreateCommand())
        {
            command.CommandText = @"
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'category' AND column_name = 'group_id'
                )";
            var result = await command.ExecuteScalarAsync();
            if (result is false)
            {
                Console.WriteLine("Adding group_id column to category table...");

                // Add the column as nullable first
                command.CommandText = @"
                    ALTER TABLE category 
                    ADD COLUMN group_id uuid NULL;";
                await command.ExecuteNonQueryAsync();

                // Add foreign key constraint
                command.CommandText = @"
                    ALTER TABLE category 
                    ADD CONSTRAINT fk_category_group_id 
                    FOREIGN KEY (group_id) REFERENCES ""group"" (id) ON DELETE CASCADE;";
                await command.ExecuteNonQueryAsync();

                Console.WriteLine("Migration completed: group_id column added to category table");
            }
        }

        // Check if sort_order column exists in option table, if not add it
        using (var command = connection.CreateCommand())
        {
            command.CommandText = @"
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'option' AND column_name = 'sort_order'
                )";
            var result = await command.ExecuteScalarAsync();
            if (result is false)
            {
                Console.WriteLine("Adding sort_order column to option table...");

                // Add the column with default value
                command.CommandText = @"
                    ALTER TABLE ""option"" 
                    ADD COLUMN sort_order integer NOT NULL DEFAULT 0;";
                await command.ExecuteNonQueryAsync();

                Console.WriteLine("Migration completed: sort_order column added to option table");
            }
        }

        // Check if boat_category table exists, if not create it
        using (var command = connection.CreateCommand())
        {
            command.CommandText = @"
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_name = 'boat_category'
                )";
            var result = await command.ExecuteScalarAsync();
            if (result is false)
            {
                Console.WriteLine("Creating boat_category table...");
                command.CommandText = @"
                    CREATE TABLE boat_category (
                        id uuid PRIMARY KEY,
                        name varchar(255) NOT NULL,
                        sort_order integer NOT NULL
                    );";
                await command.ExecuteNonQueryAsync();
                Console.WriteLine("boat_category table created successfully");
            }
        }

        // Check if boat_category_id column exists in boat table, if not add it
        using (var command = connection.CreateCommand())
        {
            command.CommandText = @"
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'boat' AND column_name = 'boat_category_id'
                )";
            var result = await command.ExecuteScalarAsync();
            if (result is false)
            {
                Console.WriteLine("Adding boat_category_id column to boat table...");

                // Add the column as nullable
                command.CommandText = @"
                    ALTER TABLE boat 
                    ADD COLUMN boat_category_id uuid NULL;";
                await command.ExecuteNonQueryAsync();

                // Add foreign key constraint
                command.CommandText = @"
                    ALTER TABLE boat 
                    ADD CONSTRAINT fk_boat_boat_category_id 
                    FOREIGN KEY (boat_category_id) REFERENCES boat_category (id) ON DELETE SET NULL;";
                await command.ExecuteNonQueryAsync();

                Console.WriteLine("Migration completed: boat_category_id column added to boat table");
            }
        }

        // Drop boat_boat_category table if it exists (migration from old structure)
        using (var command = connection.CreateCommand())
        {
            command.CommandText = @"
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_name = 'boat_boat_category'
                )";
            var result = await command.ExecuteScalarAsync();
            if (result is true)
            {
                Console.WriteLine("Dropping old boat_boat_category junction table...");
                command.CommandText = @"DROP TABLE IF EXISTS boat_boat_category CASCADE;";
                await command.ExecuteNonQueryAsync();
                Console.WriteLine("Old boat_boat_category table dropped successfully");
            }
        }

        await connection.CloseAsync();
    }
}
catch (Exception ex)
{
    Console.WriteLine($"Migration error: {ex.Message}");
}

// Global exception handling
app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        context.Response.StatusCode = 500;
        context.Response.ContentType = "application/json";

        var error = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>();
        if (error != null)
        {
            Console.WriteLine($"Global error: {error.Error.Message}");
            Console.WriteLine($"Stack trace: {error.Error.StackTrace}");

            await context.Response.WriteAsync(System.Text.Json.JsonSerializer.Serialize(new
            {
                error = "Internal server error",
                message = error.Error.Message,
                timestamp = DateTime.UtcNow
            }));
        }
    });
});

// Health check endpoint for Railway
app.MapGet("/", () => Results.Ok(new
{
    message = "Build-A-Boat API is running",
    timestamp = DateTime.UtcNow,
    environment = app.Environment.EnvironmentName
}));

app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

// Initial setup endpoint - creates first admin user (only works if no users exist)
app.MapPost("/setup/admin", async (AppDb db) =>
{
    try
    {
        // Check if any users exist
        var userCount = await db.Set<AppUser>().CountAsync();
        if (userCount > 0)
        {
            return Results.BadRequest(new { message = "Users already exist. Setup not needed." });
        }

        // Create first admin user using raw SQL to ensure proper insertion
        var userId = Guid.NewGuid();
        var email = "admin@example.com";
        var password = "admin123";
        var passwordHash = BCrypt.Net.BCrypt.HashPassword(password);
        var now = DateTime.UtcNow;

        Console.WriteLine($"[SETUP] Creating admin user with email: {email}");
        Console.WriteLine($"[SETUP] Password hash created: {!string.IsNullOrEmpty(passwordHash)}");

        await db.Database.ExecuteSqlRawAsync(
            "INSERT INTO app_user (id, email, password_hash, role, created_at, updated_at) VALUES (@id, @email, @passwordHash, @role, @createdAt, @updatedAt)",
            new NpgsqlParameter("id", userId),
            new NpgsqlParameter("email", email),
            new NpgsqlParameter("passwordHash", passwordHash),
            new NpgsqlParameter("role", "admin"),
            new NpgsqlParameter("createdAt", now),
            new NpgsqlParameter("updatedAt", now)
        );

        Console.WriteLine($"[SETUP] Admin user created successfully with ID: {userId}");

        return Results.Ok(new
        {
            message = "Admin user created successfully",
            email = email,
            password = password,
            id = userId
        });
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Setup error: {ex.Message}");
        Console.WriteLine($"Setup stack trace: {ex.StackTrace}");
        return Results.Problem($"Failed to create admin user: {ex.Message}");
    }
});

// Debug endpoint to check configuration
app.MapGet("/debug/config", () =>
{
    var dbUrl = Environment.GetEnvironmentVariable("DATABASE_URL");
    var dbUrlPreview = string.IsNullOrEmpty(dbUrl) ? "null" :
        dbUrl.Length > 30 ? $"{dbUrl.Substring(0, 30)}...{dbUrl.Substring(dbUrl.Length - 15)}" : dbUrl;

    return Results.Ok(new
    {
        hasJwtSecret = !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("JWT_SECRET")),
        jwtIssuer = Environment.GetEnvironmentVariable("JWT_ISSUER"),
        jwtAudience = Environment.GetEnvironmentVariable("JWT_AUDIENCE"),
        hasDatabaseUrl = !string.IsNullOrEmpty(dbUrl),
        databaseUrlPreview = dbUrlPreview,
        pgHost = Environment.GetEnvironmentVariable("PGHOST"),
        pgPort = Environment.GetEnvironmentVariable("PGPORT"),
        pgDatabase = Environment.GetEnvironmentVariable("PGDATABASE"),
        pgUser = Environment.GetEnvironmentVariable("PGUSER"),
        hasPgPassword = !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("PGPASSWORD")),
        environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development"
    });
});

// Database test endpoint
app.MapGet("/debug/db-test", async (AppDb db) =>
{
    try
    {
        await db.Database.CanConnectAsync();

        // Try to count users
        var userCount = await db.Set<AppUser>().CountAsync();

        return Results.Ok(new
        {
            status = "Database connection successful",
            userCount = userCount
        });
    }
    catch (Exception ex)
    {
        return Results.Ok(new
        {
            status = "Database operation failed",
            error = ex.Message,
            stackTrace = ex.StackTrace?.Substring(0, 500)
        });
    }
});

// S3 configuration check endpoint
app.MapGet("/debug/s3-config", () =>
{
    var s3Bucket = Environment.GetEnvironmentVariable("AWS_S3_BUCKET");
    var cloudFrontDomain = Environment.GetEnvironmentVariable("CLOUDFRONT_DOMAIN");
    var awsRegion = Environment.GetEnvironmentVariable("AWS_REGION");

    return Results.Ok(new
    {
        hasS3Bucket = !string.IsNullOrEmpty(s3Bucket),
        s3Bucket = s3Bucket,
        hasCloudFront = !string.IsNullOrEmpty(cloudFrontDomain),
        cloudFrontDomain = cloudFrontDomain,
        awsRegion = awsRegion ?? "us-east-1",
        exampleUrl = !string.IsNullOrEmpty(cloudFrontDomain)
            ? $"https://{cloudFrontDomain}/media/example.jpg"
            : !string.IsNullOrEmpty(s3Bucket)
                ? $"https://{s3Bucket}.s3.{awsRegion ?? "us-east-1"}.amazonaws.com/media/example.jpg"
                : "S3 not configured"
    });
});

// Check all media in database
app.MapGet("/debug/all-media", async (AppDb db) =>
{
    try
    {
        var allMedia = await db.Media.ToListAsync();
        return Results.Ok(new
        {
            count = allMedia.Count,
            media = allMedia.Select(m => new { m.Id, m.Url, m.FileName, m.UploadedAt }).ToList()
        });
    }
    catch (Exception ex)
    {
        return Results.Ok(new { error = ex.Message, stack = ex.StackTrace });
    }
});

// User check endpoint that works in production
app.MapGet("/debug/users", async (AppDb db) =>
{
    try
    {
        var users = await db.Set<AppUser>()
            .AsNoTracking()
            .Select(u => new { u.Id, u.Email, u.Role, HasPassword = !string.IsNullOrEmpty(u.PasswordHash) })
            .ToListAsync();

        return Results.Ok(new { users = users, count = users.Count });
    }
    catch (Exception ex)
    {
        return Results.Ok(new
        {
            status = "Error fetching users",
            error = ex.Message
        });
    }
});

// Simple login test endpoint
app.MapPost("/debug/login-test", async (AppDb db) =>
{
    try
    {
        Console.WriteLine("[LOGIN-TEST] Starting login test");

        // Find the admin user
        var user = await db.Set<AppUser>()
            .AsNoTracking()
            .Where(u => u.Email == "admin@example.com")
            .FirstOrDefaultAsync();

        if (user == null)
        {
            return Results.Ok(new { status = "User not found" });
        }

        // Test password verification
        var passwordValid = BCrypt.Net.BCrypt.Verify("admin123", user.PasswordHash);

        return Results.Ok(new
        {
            status = "Login test complete",
            userFound = true,
            email = user.Email,
            role = user.Role,
            hasPassword = !string.IsNullOrEmpty(user.PasswordHash),
            passwordValid = passwordValid
        });
    }
    catch (Exception ex)
    {
        return Results.Ok(new
        {
            status = "Login test failed",
            error = ex.Message
        });
    }
});

var port = Environment.GetEnvironmentVariable("PORT") ?? "5000";
Console.WriteLine($"Starting server on port: {port}");
app.Urls.Add($"http://0.0.0.0:{port}");

app.UseCors();

// Serve static files for development (uploaded images)
if (app.Environment.IsDevelopment())
{
    app.UseStaticFiles();
}

app.UseAuthentication();
app.UseAuthorization();

// Swagger UI
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

var admin = app.MapGroup("/admin").RequireAuthorization("Admin");

//Login - issue JWT
app.MapPost("/auth/login", async (LoginRequest req, AppDb db) =>
{
    Console.WriteLine($"[LOGIN] === LOGIN ATTEMPT STARTED ===");

    try
    {
        // Basic validation
        if (req == null || string.IsNullOrEmpty(req.Email) || string.IsNullOrEmpty(req.Password))
        {
            Console.WriteLine("[LOGIN] Invalid request data");
            return Results.BadRequest(new { message = "Email and password are required" });
        }

        var email = req.Email.Trim().ToLowerInvariant();
        Console.WriteLine($"[LOGIN] Looking for user: {email}");

        // Find user
        var user = await db.Set<AppUser>()
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Email == email);

        if (user == null)
        {
            Console.WriteLine("[LOGIN] User not found");
            return Results.Unauthorized();
        }

        Console.WriteLine($"[LOGIN] User found: {user.Email}");

        // Verify password
        if (!BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
        {
            Console.WriteLine("[LOGIN] Password invalid");
            return Results.Unauthorized();
        }

        Console.WriteLine("[LOGIN] Password verified, creating token");

        // Create JWT
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role)
        };

        var token = new JwtSecurityToken(
            issuer: jwtIssuer,
            audience: jwtAudience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(8),
            signingCredentials: creds
        );

        var jwt = new JwtSecurityTokenHandler().WriteToken(token);
        Console.WriteLine("[LOGIN] JWT created successfully");

        return Results.Ok(new
        {
            token = jwt,
            user = new
            {
                user.Id,
                user.Email,
                user.Role,
                user.Username,
                user.FirstName,
                user.LastName,
                user.Timezone,
                user.AvatarUrl
            }
        });
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[LOGIN ERROR] {ex.Message}");
        Console.WriteLine($"[LOGIN ERROR] Stack trace: {ex.StackTrace}");
        return Results.Problem($"Login failed: {ex.Message}");
    }
});

//Forgot password
app.MapPost("/auth/forgot-password", async (ForgotPasswordRequest req, AppDb db, IEmailService emailService) =>
{
    var email = req.Email.Trim().ToLowerInvariant();
    var user = await db.Set<AppUser>()
        .AsNoTracking()
        .Where(u => u.Email == email)
        .Select(u => new AppUser { Id = u.Id, Email = u.Email })
        .FirstOrDefaultAsync();

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

    // Send password reset email
    try
    {
        await emailService.SendPasswordResetEmailAsync(user.Email, token);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[EMAIL ERROR] Failed to send password reset email: {ex.Message}");
        // Don't fail the request if email fails - still return success message for security
    }

    return Results.Ok(new
    {
        message = "If that email is registered, a reset link has been sent.",
        // Remove these in production - only for development/testing
        resetToken = token,
        resetLink = $"https://build-a-boat.vercel.app/admin/reset-password?token={token}"
    });
});

//Reset password
app.MapPost("/auth/reset-password", async (ResetPasswordRequest req, AppDb db) =>
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
app.MapGet("/boat", async (AppDb db) =>
 Results.Ok(await db.Boats.Where(b => b.IsActive)
 .Select(b => new { b.Slug, b.Name, b.BasePrice })
 .OrderBy(b => b.Name)
 .ToListAsync()));

//List roles
admin.MapGet("/roles", async (HttpRequest http, AppDb db) =>
{
    var search = http.Query["search"].ToString()?.Trim().ToLower();
    var q = db.Roles.AsNoTracking();
    if (!string.IsNullOrEmpty(search))
        q = q.Where(r => r.Name.ToLower().Contains(search) || r.Slug.ToLower().Contains(search));

    var items = await q.OrderBy(r => r.Name).ToListAsync();
    return Results.Ok(new { items });
});

//Create role
admin.MapPost("/roles", async (RoleUpsert dto, AppDb db) =>
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
    return Results.Created($"/admin/roles/{r.Id}", r);
});

//Update role
admin.MapPatch("/roles/{id:guid}", async (Guid id, RoleUpsert dto, AppDb db) =>
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
admin.MapDelete("/roles/{id:guid}", async (Guid id, AppDb db) =>
{
    var r = await db.Roles.FindAsync(id);
    if (r is null) return Results.NotFound();

    db.Roles.Remove(r);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

//get all timezones
app.MapGet("/settings", async (AppDb db) =>
{
    var items = await db.Set<AppSettings>().OrderBy(s => s.key).Select(s => new SettingDto(s.key, s.value)).ToListAsync();
    return Results.Ok(new { items });
});

//get Single
admin.MapGet("/settings/{key}", async (string key, AppDb db) =>
{
    var s = await db.Set<AppSettings>().FindAsync(key);
    return s is null ? Results.NotFound() : Results.Ok(new SettingDto(s.key, s.value));
});

//upset single
admin.MapPut("/settings/{key}", async (string key, SettingDto dto, AppDb db) =>
{
    var s = await db.Set<AppSettings>().FindAsync(key);
    if (s is null)
    {
        s = new AppSettings { key = key, value = dto.Value, updatedAt = DateTime.UtcNow };
        db.Settings.Add(s);
    }
    else
    {
        s.value = dto.Value;
        s.updatedAt = DateTime.UtcNow;
    }
    await db.SaveChangesAsync();
    return Results.Ok(new SettingDto(s.key, s.value));
});

//get timezones
admin.MapGet("/settings/timezone", async (AppDb db) =>
{
    var setting = await db.Settings
        .Where(s => s.key == "system.timezone")
        .Select(s => s.value)
        .FirstOrDefaultAsync();

    return Results.Ok(new { value = setting ?? "UTC" });
});

//set timezones
admin.MapPut("/settings/system/timezone", async (SettingDto dto, AppDb db) =>
{
    var setting = await db.Settings.FirstOrDefaultAsync(s => s.key == dto.Key);
    if (setting == null)
    {
        setting = new AppSettings { key = dto.Key, value = dto.Value };
        db.Settings.Add(setting);
    }
    else
    {
        setting.value = dto.Value;
    }
    await db.SaveChangesAsync();
    return Results.Ok(new { value = setting.value });
});

//Boat config 
app.MapGet("/boat/{slug}/config", async (string slug, AppDb db) =>
{
    var sql = "SELECT * FROM v_boat_config WHERE slug = @slug";
    var param = new NpgsqlParameter("slug", slug);
    var row = await db.BoatConfigs.FromSqlRaw(sql, param).SingleOrDefaultAsync();
    return row is null ? Results.NotFound() : Results.Ok(row.AsJson());
});

//Price + save build
app.MapPost("/builds", async (
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
        Selections = JsonDocument.Parse(JsonSerializer.Serialize(selected)),
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
    var count = await db.Set<AppUser>().CountAsync();
    return Results.Ok(new { count });
});


//User list with paging
admin.MapGet("/users", async (HttpRequest http, AppDb db) =>
{
    var q = http.Query;
    var search = q["search"].ToString()?.Trim();
    int page = int.TryParse(q["page"], out var p) ? Math.Max(1, p) : 1;
    int pageSize = int.TryParse(q["pageSize"], out var s) ? Math.Clamp(s, 1, 100) : 25;

    var qry = db.Set<AppUser>().AsNoTracking();

    if (!string.IsNullOrEmpty(search))
    {
        var sterm = search.ToLower();
        qry = qry.Where(u => u.Email.ToLower().Contains(sterm));
    }

    var total = await qry.CountAsync();

    var items = await qry
        .OrderBy(u => u.Email)
        .Skip((page - 1) * pageSize)
        .Take(pageSize)
        .Select(u => new
        {
            id = u.Id,
            email = u.Email,
            username = u.Username,
            role = u.Role,
            createdAt = u.CreatedAt,
            updatedAt = u.UpdatedAt
        })
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
    return Results.Created($"/admin/users/{u.Id}", new { u.Id });
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
admin.MapGet("/boat", async (HttpRequest req, AppDb db) =>
{
    var search = (req.Query["search"].ToString() ?? "").Trim().ToLowerInvariant();
    var q = db.Boats.AsNoTracking();
    if (!string.IsNullOrWhiteSpace(search))
        q = q.Where(b => b.Name.ToLower().Contains(search) || b.Slug.ToLower().Contains(search));

    var items = await q.OrderByDescending(b => b.ModelYear).ThenBy(b => b.Name).ToListAsync();
    return Results.Ok(new { items });
});

//Create boat
admin.MapPost("/boat", async (BoatUpsert dto, AppDb db) =>
{
    // Check if slug already exists
    if (await db.Boats.AnyAsync(b => b.Slug == dto.Slug))
        return Results.Conflict(new { message = "Boat with same slug already exists" });

    var b = new Boat
    {
        Id = Guid.NewGuid(),
        Slug = dto.Slug,
        Name = dto.Name,
        BasePrice = dto.BasePrice,
        ModelYear = dto.ModelYear,
        IsActive = true,

        // Now that columns exist in database, we can set these properties
        Features = dto.Features is null ? null : JsonSerializer.Serialize(dto.Features),
        PrimaryImageUrl = dto.PrimaryImageUrl,
        SecondaryImageUrl = dto.SecondaryImageUrl,
        SideImageUrl = dto.SideImageUrl,
        LogoImageUrl = dto.LogoImageUrl
    };

    // Add the boat to the database context
    db.Boats.Add(b);

    if (dto.LayerMediaIds is { Count: > 0 })
    {
        var rows = dto.LayerMediaIds.Select((mid, i) => new BoatLayerMedia
        {
            BoatId = b.Id,
            MediaId = mid,
            SortOrder = i
        });
        db.BoatLayerMedias.AddRange(rows);
    }

    // Save all changes to the database
    await db.SaveChangesAsync();

    return Results.Created($"/admin/boat/{b.Id}", b);
});

//Get single boat by ID
admin.MapGet("/boat/{id:guid}", async (Guid id, AppDb db) =>
{
    var b = await db.Boats
        .Include(x => x.Categories)
        .FirstOrDefaultAsync(x => x.Id == id);

    if (b is null) return Results.NotFound();
    return Results.Ok(b);
});

//toggle active boat
admin.MapPost("/boat/{id:guid}/toggle-active", async (Guid id, AppDb db) =>
{
    var b = await db.Boats.FindAsync(id);
    if (b is null) return Results.NotFound();
    b.IsActive = !b.IsActive;
    await db.SaveChangesAsync();
    return Results.Ok(b);
});

//duplicate boat
admin.MapPost("/boat/{id:guid}/duplicate", async (Guid id, DuplicateBoatDto dto, AppDb db) =>
{
    var src = await db.Boats.FindAsync(id);
    if (src is null) return Results.NotFound();

    if (await db.Boats.AnyAsync(b => b.Slug == dto.NewSlug))
        return Results.Conflict(new { message = "Boat with same slug already exists" });

    var copy = new Boat
    {
        Id = Guid.NewGuid(),
        Slug = dto.NewSlug,
        Name = string.IsNullOrWhiteSpace(dto.NewName) ? $"{src.Name} Copy" : dto.NewName!,
        BasePrice = src.BasePrice,
        ModelYear = dto.NewModelYear ?? src.ModelYear,
        IsActive = false,
        HeroImageUrl = src.HeroImageUrl
    };

    db.Boats.Add(copy);
    await db.SaveChangesAsync();
    return Results.Created($"/admin/boat/{copy.Id}", copy);
});

//Update boat
admin.MapPatch("/boat/{id:guid}", async (Guid id, BoatUpsert dto, AppDb db) =>
{
    var b = await db.Boats.FindAsync(id);
    if (b is null) return Results.NotFound();
    b.Slug = dto.Slug;
    b.Name = dto.Name;
    b.BasePrice = dto.BasePrice;
    b.ModelYear = dto.ModelYear;

    // Update the new properties
    b.Features = dto.Features is null ? null : JsonSerializer.Serialize(dto.Features);
    b.PrimaryImageUrl = dto.PrimaryImageUrl;
    b.SecondaryImageUrl = dto.SecondaryImageUrl;
    b.SideImageUrl = dto.SideImageUrl;
    b.LogoImageUrl = dto.LogoImageUrl;

    await db.SaveChangesAsync();
    return Results.Ok(b);
});

//Delete boat
admin.MapDelete("/boat/{id:guid}", async (Guid id, AppDb db) =>
{
    var b = await db.Boats.FindAsync(id);
    if (b is null) return Results.NotFound();
    db.Boats.Remove(b);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

//media
admin.MapGet("/media", async (AppDb db) =>
{
    return Results.Ok(await db.Media.OrderByDescending(m => m.Id).ToListAsync());
});

//create media
admin.MapPost("/media", async (MediaCreateDto dto, AppDb db) =>
{
    if (string.IsNullOrWhiteSpace(dto.Url)) return Results.BadRequest(new { message = "Url required" });
    var m = new Media { Id = Guid.NewGuid(), Url = dto.Url, Label = dto.Label };
    db.Media.Add(m);
    await db.SaveChangesAsync();
    return Results.Created($"/admin/media/{m.Id}", m);
});

//upload to specific folder (MUST come before /media/upload)
admin.MapPost("/media/upload/{*folderPath}", async (string folderPath, HttpRequest req, IWebHostEnvironment env, AppDb db, IS3Service s3Service) =>
{
    if (!req.HasFormContentType)
        return Results.BadRequest(new { message = "Invalid form data" });

    var form = await req.ReadFormAsync();
    var file = form.Files.GetFile("file");
    if (file is null || file.Length == 0)
        return Results.BadRequest(new { message = "No file uploaded" });

    // Validate file type and size
    var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" };
    if (!allowedTypes.Contains(file.ContentType))
        return Results.BadRequest(new { message = "Only image files are allowed" });

    if (file.Length > 10 * 1024 * 1024) // 10MB limit
        return Results.BadRequest(new { message = "File size must be less than 10MB" });

    try
    {
        // Option 1: AWS S3 (Production)
        var s3BucketName = Environment.GetEnvironmentVariable("AWS_S3_BUCKET");
        if (!string.IsNullOrEmpty(s3BucketName))
        {
            Console.WriteLine($"[S3] Uploading file: {file.FileName} to folder: {folderPath}");
            var s3Url = await s3Service.UploadFileAsync(file, folderPath);
            Console.WriteLine($"[S3] File uploaded successfully: {s3Url}");

            if (string.IsNullOrEmpty(s3Url))
            {
                Console.WriteLine("[S3] ERROR: S3 service returned empty URL for folder upload");
                return Results.Problem("S3 upload returned empty URL");
            }

            var m = new Media
            {
                Id = Guid.NewGuid(),
                FileName = file.FileName,
                ContentType = file.ContentType,
                Url = s3Url,
                UploadedAt = DateTime.UtcNow
            };

            try
            {
                Console.WriteLine($"[S3] Adding media to context: Id={m.Id}, Url={m.Url}, FileName={m.FileName}, FolderPath={folderPath}");
                db.Media.Add(m);
                await db.SaveChangesAsync();
                Console.WriteLine($"[S3] Media saved to database with ID: {m.Id}");
            }
            catch (DbUpdateException dbEx)
            {
                Console.WriteLine($"[ERROR] Database update error: {dbEx.Message}");
                Console.WriteLine($"[ERROR] Entries: {string.Join(", ", dbEx.Entries.Select(e => $"{e.Entity.GetType().Name}:{e.State}"))}");
                if (dbEx.InnerException != null)
                {
                    Console.WriteLine($"[ERROR] Inner exception: {dbEx.InnerException.Message}");
                    Console.WriteLine($"[ERROR] Inner stacktrace: {dbEx.InnerException.StackTrace}");
                }
                if (dbEx.InnerException?.InnerException != null)
                {
                    Console.WriteLine($"[ERROR] Inner inner exception: {dbEx.InnerException.InnerException.Message}");
                }
                return Results.Problem($"Database error: {dbEx.InnerException?.Message ?? dbEx.Message}");
            }
            catch (Exception dbEx)
            {
                Console.WriteLine($"[ERROR] Database save error: {dbEx.GetType().Name}: {dbEx.Message}");
                Console.WriteLine($"[ERROR] Stacktrace: {dbEx.StackTrace}");
                if (dbEx.InnerException != null)
                {
                    Console.WriteLine($"[ERROR] Inner exception: {dbEx.InnerException.Message}");
                }
                return Results.Problem($"Database error: {dbEx.InnerException?.Message ?? dbEx.Message}");
            }

            return Results.Created($"/admin/media/{m.Id}", m);
        }

        // Option 2: Local file storage (Development only)
        if (env.IsDevelopment())
        {
            var uploadsDir = Path.Combine(env.WebRootPath ?? env.ContentRootPath, "uploads", folderPath);
            Directory.CreateDirectory(uploadsDir);

            var fileName = $"{Guid.NewGuid()}_{file.FileName}";
            var filePath = Path.Combine(uploadsDir, fileName);

            using var stream = File.Create(filePath);
            await file.CopyToAsync(stream);

            var fileUrl = $"/uploads/{folderPath}/{fileName}";

            var m = new Media
            {
                Id = Guid.NewGuid(),
                FileName = file.FileName,
                ContentType = file.ContentType,
                Url = fileUrl,
                UploadedAt = DateTime.UtcNow
            };
            db.Media.Add(m);
            await db.SaveChangesAsync();
            return Results.Created($"/admin/media/{m.Id}", m);
        }

        // Fallback: Return error if no storage method is configured
        return Results.Problem("No file storage method configured. Set AWS_S3_BUCKET environment variable or run in development mode.");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Media upload error: {ex.Message}");
        Console.WriteLine($"Stack trace: {ex.StackTrace}");
        return Results.Problem($"Upload failed: {ex.Message}");
    }
});

//upload media - redirect to media folder
admin.MapPost("/media/upload", async (HttpRequest req, IWebHostEnvironment env, AppDb db, IS3Service s3Service) =>
{
    Console.WriteLine("[UPLOAD] Using /media/upload endpoint (no folder specified)");

    if (!req.HasFormContentType)
        return Results.BadRequest(new { message = "Invalid form data" });

    var form = await req.ReadFormAsync();
    var file = form.Files.GetFile("file");
    if (file is null || file.Length == 0)
        return Results.BadRequest(new { message = "No file uploaded" });

    // Validate file type and size
    var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" };
    if (!allowedTypes.Contains(file.ContentType))
        return Results.BadRequest(new { message = "Only image files are allowed" });

    if (file.Length > 10 * 1024 * 1024) // 10MB limit
        return Results.BadRequest(new { message = "File size must be less than 10MB" });

    try
    {
        // Option 1: AWS S3 (Production)
        var s3BucketName = Environment.GetEnvironmentVariable("AWS_S3_BUCKET");
        if (!string.IsNullOrEmpty(s3BucketName))
        {
            Console.WriteLine($"[S3] Uploading file: {file.FileName} to default 'media' folder");
            var s3Url = await s3Service.UploadFileAsync(file, "media");
            Console.WriteLine($"[S3] File uploaded successfully: {s3Url}");

            if (string.IsNullOrEmpty(s3Url))
            {
                Console.WriteLine("[S3] ERROR: S3 service returned empty URL");
                return Results.Problem("S3 upload returned empty URL");
            }

            var m = new Media
            {
                Id = Guid.NewGuid(),
                FileName = file.FileName,
                ContentType = file.ContentType,
                Url = s3Url,
                UploadedAt = DateTime.UtcNow
            };

            try
            {
                Console.WriteLine($"[S3] Adding media to context: Id={m.Id}, Url={m.Url}, FileName={m.FileName}");
                db.Media.Add(m);
                await db.SaveChangesAsync();
                Console.WriteLine($"[S3] Media saved to database with ID: {m.Id}");
            }
            catch (DbUpdateException dbEx)
            {
                Console.WriteLine($"[ERROR] Database update error: {dbEx.Message}");
                Console.WriteLine($"[ERROR] Entries: {string.Join(", ", dbEx.Entries.Select(e => $"{e.Entity.GetType().Name}:{e.State}"))}");
                if (dbEx.InnerException != null)
                {
                    Console.WriteLine($"[ERROR] Inner exception: {dbEx.InnerException.Message}");
                    Console.WriteLine($"[ERROR] Inner stacktrace: {dbEx.InnerException.StackTrace}");
                }
                if (dbEx.InnerException?.InnerException != null)
                {
                    Console.WriteLine($"[ERROR] Inner inner exception: {dbEx.InnerException.InnerException.Message}");
                }
                return Results.Problem($"Database error: {dbEx.InnerException?.Message ?? dbEx.Message}");
            }
            catch (Exception dbEx)
            {
                Console.WriteLine($"[ERROR] Database save error: {dbEx.GetType().Name}: {dbEx.Message}");
                Console.WriteLine($"[ERROR] Stacktrace: {dbEx.StackTrace}");
                if (dbEx.InnerException != null)
                {
                    Console.WriteLine($"[ERROR] Inner exception: {dbEx.InnerException.Message}");
                }
                return Results.Problem($"Database error: {dbEx.InnerException?.Message ?? dbEx.Message}");
            }

            return Results.Created($"/admin/media/{m.Id}", m);
        }

        // Option 2: Local file storage (Development only)
        if (env.IsDevelopment())
        {
            var uploadsDir = Path.Combine(env.WebRootPath ?? env.ContentRootPath, "uploads", "media");
            Directory.CreateDirectory(uploadsDir);

            var fileName = $"{Guid.NewGuid()}_{file.FileName}";
            var filePath = Path.Combine(uploadsDir, fileName);

            using var stream = File.Create(filePath);
            await file.CopyToAsync(stream);

            var fileUrl = $"/uploads/media/{fileName}";

            var m = new Media
            {
                Id = Guid.NewGuid(),
                FileName = file.FileName,
                ContentType = file.ContentType,
                Url = fileUrl,
                UploadedAt = DateTime.UtcNow
            };
            db.Media.Add(m);
            await db.SaveChangesAsync();
            return Results.Created($"/admin/media/{m.Id}", m);
        }

        // Fallback: Return error if no storage method is configured
        return Results.Problem("No file storage method configured. Set AWS_S3_BUCKET environment variable or run in development mode.");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Media upload error: {ex.Message}");
        Console.WriteLine($"Stack trace: {ex.StackTrace}");
        return Results.Problem($"Upload failed: {ex.Message}");
    }
});//delete media
admin.MapDelete("/media/{id:guid}", async (Guid id, AppDb db, IS3Service s3Service) =>
{
    var media = await db.Media.FindAsync(id);
    if (media is null) return Results.NotFound();

    try
    {
        // Delete from S3 if it's an S3 or CloudFront URL
        var s3BucketName = Environment.GetEnvironmentVariable("AWS_S3_BUCKET");
        var cloudFrontDomain = Environment.GetEnvironmentVariable("CLOUDFRONT_DOMAIN");

        // Check if it's an S3 or CloudFront URL
        bool isS3Url = !string.IsNullOrEmpty(s3BucketName) && media.Url.Contains(s3BucketName);
        bool isCloudFrontUrl = !string.IsNullOrEmpty(cloudFrontDomain) && media.Url.Contains(cloudFrontDomain);

        if (isS3Url || isCloudFrontUrl)
        {
            Console.WriteLine($"[S3] Deleting file: {media.Url}");
            var deleted = await s3Service.DeleteFileAsync(media.Url);
            if (!deleted)
            {
                Console.WriteLine($"[S3] Warning: Failed to delete file from S3: {media.Url}");
            }
        }
        else if (media.Url.StartsWith("/uploads/"))
        {
            // Delete local file if it exists
            var fileName = media.Url.Replace("/uploads/", "");
            var filePath = Path.Combine("uploads", fileName);
            if (File.Exists(filePath))
            {
                File.Delete(filePath);
                Console.WriteLine($"[LOCAL] Deleted local file: {filePath}");
            }
        }

        // Remove from database
        db.Media.Remove(media);
        await db.SaveChangesAsync();

        Console.WriteLine($"[DB] Deleted media record: {media.Id}");
        return Results.NoContent();
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Delete media error: {ex.Message}");
        return Results.Problem($"Delete failed: {ex.Message}");
    }
});

//list folders in S3
admin.MapGet("/media/folders", async (HttpRequest req, IS3Service s3Service) =>
{
    var prefix = req.Query["prefix"].ToString();
    var folders = await s3Service.ListFoldersAsync(prefix);
    return Results.Ok(new { folders });
});

//list files in folder
admin.MapGet("/media/folder/{*path}", async (string path, IS3Service s3Service) =>
{
    var files = await s3Service.ListFilesInFolderAsync(path);
    return Results.Ok(new { files });
});

// Delete media by URL
admin.MapPost("/media/delete", async (HttpRequest req, AppDb db, IS3Service s3Service) =>
{
    var body = await req.ReadFromJsonAsync<JsonElement>();
    var url = body.GetProperty("url").GetString();

    if (string.IsNullOrEmpty(url))
        return Results.BadRequest(new { message = "URL is required" });

    Console.WriteLine($"[DELETE] Looking for media with URL: {url}");

    var media = await db.Media.FirstOrDefaultAsync(m => m.Url == url);
    if (media is null)
    {
        // Log all media URLs in database for debugging
        var allMedia = await db.Media.ToListAsync();
        Console.WriteLine($"[DELETE] Media not found. Database contains {allMedia.Count} media records:");
        foreach (var m in allMedia.Take(5))
        {
            Console.WriteLine($"  - ID: {m.Id}, URL: {m.Url}");
        }
        return Results.NotFound(new { message = "Media not found", searchedUrl = url, databaseCount = allMedia.Count });
    }

    try
    {
        // Delete from S3 if it's an S3 or CloudFront URL
        var s3BucketName = Environment.GetEnvironmentVariable("AWS_S3_BUCKET");
        var cloudFrontDomain = Environment.GetEnvironmentVariable("CLOUDFRONT_DOMAIN");

        // Check if it's an S3 or CloudFront URL
        bool isS3Url = !string.IsNullOrEmpty(s3BucketName) && media.Url.Contains(s3BucketName);
        bool isCloudFrontUrl = !string.IsNullOrEmpty(cloudFrontDomain) && media.Url.Contains(cloudFrontDomain);

        if (isS3Url || isCloudFrontUrl)
        {
            Console.WriteLine($"[S3] Deleting file: {media.Url}");
            var deleted = await s3Service.DeleteFileAsync(media.Url);
            if (!deleted)
            {
                Console.WriteLine($"[S3] Warning: Failed to delete file from S3: {media.Url}");
            }
        }

        // Remove from database
        db.Media.Remove(media);
        await db.SaveChangesAsync();

        Console.WriteLine($"[DB] Deleted media record: {media.Id}");
        return Results.NoContent();
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Delete media error: {ex.Message}");
        return Results.Problem($"Delete failed: {ex.Message}");
    }
});

// Delete folder and all its contents
admin.MapPost("/media/folder/delete", async (HttpRequest req, AppDb db, IS3Service s3Service) =>
{
    var body = await req.ReadFromJsonAsync<JsonElement>();
    var folderPath = body.GetProperty("folderPath").GetString();

    if (string.IsNullOrEmpty(folderPath))
        return Results.BadRequest(new { message = "Folder path is required" });

    try
    {
        // Get all files in the folder from S3
        var files = await s3Service.ListFilesInFolderAsync(folderPath);

        // Delete each file from S3 and database
        foreach (var file in files)
        {
            // Delete from S3
            var deleted = await s3Service.DeleteFileAsync(file.Url);
            if (!deleted)
            {
                Console.WriteLine($"[S3] Warning: Failed to delete file from S3: {file.Url}");
            }

            // Delete from database
            var media = await db.Media.FirstOrDefaultAsync(m => m.Url == file.Url);
            if (media != null)
            {
                db.Media.Remove(media);
            }
        }

        await db.SaveChangesAsync();
        Console.WriteLine($"[DB] Deleted folder and {files.Count} files: {folderPath}");
        return Results.Ok(new { deletedFiles = files.Count });
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Delete folder error: {ex.Message}");
        return Results.Problem($"Delete failed: {ex.Message}");
    }
});

// Categories
// Groups endpoints
admin.MapGet("/boat/{boatId:guid}/groups", async (Guid boatId, AppDb db) =>
{
    try
    {
        var groups = await db.Groups
            .Where(g => g.BoatId == boatId)
            .Include(g => g.Categories)
            .OrderBy(g => g.SortOrder)
            .ToListAsync();

        // Load the nested data for each category
        foreach (var group in groups)
        {
            foreach (var category in group.Categories)
            {
                var optionGroups = await db.OptionGroups
                    .Where(og => og.CategoryId == category.Id)
                    .Include(og => og.Options)
                    .OrderBy(og => og.SortOrder)
                    .ToListAsync();

                category.OptionsGroups = optionGroups;
            }
        }

        return Results.Ok(groups);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Error fetching groups: {ex.Message}");
        Console.WriteLine($"Stack trace: {ex.StackTrace}");
        return Results.Problem($"Error fetching groups: {ex.Message}");
    }
});

admin.MapPost("/groups", async (GroupUpsert dto, AppDb db) =>
{
    var g = new Group { Id = Guid.NewGuid(), BoatId = dto.BoatId, Name = dto.Name, SortOrder = dto.SortOrder };
    db.Groups.Add(g);
    await db.SaveChangesAsync();
    return Results.Created($"/admin/groups/{g.Id}", g);
});

admin.MapPatch("/groups/{id:guid}", async (Guid id, GroupUpsert dto, AppDb db) =>
{
    var g = await db.Groups.FindAsync(id);
    if (g is null) return Results.NotFound();
    g.Name = dto.Name;
    g.SortOrder = dto.SortOrder;
    await db.SaveChangesAsync();
    return Results.Ok(g);
});

admin.MapDelete("/groups/{id:guid}", async (Guid id, AppDb db) =>
{
    var g = await db.Groups.FindAsync(id);
    if (g is null) return Results.NotFound();
    db.Groups.Remove(g);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

admin.MapGet("/category", async (AppDb db) =>
    Results.Ok(new { items = await db.Categories.Where(c => c.GroupId != null).OrderBy(c => c.Name).ToListAsync() }));

admin.MapGet("/boat-categories", async (AppDb db, string? search) =>
{
    var query = db.BoatCategories.AsQueryable();
    if (!string.IsNullOrEmpty(search))
    {
        query = query.Where(bc => bc.Name.ToLower().Contains(search.ToLower()));
    }
    var items = await query.OrderBy(bc => bc.SortOrder).ToListAsync();
    return Results.Ok(new { items = items.Select(bc => new BoatCategoryRow(bc.Id, bc.Name, bc.SortOrder)) });
});

// Create boat category
admin.MapPost("/boat-categories", async (BoatCategoryUpsert dto, AppDb db) =>
{
    var sortOrder = await db.BoatCategories.CountAsync();
    var bc = new BoatCategory
    {
        Id = Guid.NewGuid(),
        Name = dto.Name,
        SortOrder = dto.SortOrder
    };
    db.BoatCategories.Add(bc);
    await db.SaveChangesAsync();
    return Results.Created($"/admin/boat-categories/{bc.Id}", new BoatCategoryRow(bc.Id, bc.Name, bc.SortOrder));
});

// Update boat category
admin.MapPatch("/boat-categories/{id:guid}", async (Guid id, BoatCategoryUpsert dto, AppDb db) =>
{
    var bc = await db.BoatCategories.FindAsync(id);
    if (bc is null) return Results.NotFound();
    bc.Name = dto.Name;
    bc.SortOrder = dto.SortOrder;
    await db.SaveChangesAsync();
    return Results.Ok(new BoatCategoryRow(bc.Id, bc.Name, bc.SortOrder));
});

// Delete boat category
admin.MapDelete("/boat-categories/{id:guid}", async (Guid id, AppDb db) =>
{
    var bc = await db.BoatCategories.FindAsync(id);
    if (bc is null) return Results.NotFound();
    db.BoatCategories.Remove(bc);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

// Assign boat to boat category (updates boat.boat_category_id)
admin.MapPost("/boat-categories/{boatCategoryId:guid}/boats/{boatId:guid}", async (Guid boatCategoryId, Guid boatId, AppDb db) =>
{
    var bc = await db.BoatCategories.FindAsync(boatCategoryId);
    if (bc is null) return Results.NotFound(new { message = "Boat category not found" });

    var boat = await db.Boats.FindAsync(boatId);
    if (boat is null) return Results.NotFound(new { message = "Boat not found" });

    boat.BoatCategoryId = boatCategoryId;
    await db.SaveChangesAsync();
    return Results.Created($"/admin/boat-categories/{boatCategoryId}", new { message = "Boat added to category" });
});

// Remove boat from boat category (clears boat.boat_category_id)
admin.MapDelete("/boat-categories/{boatCategoryId:guid}/boats/{boatId:guid}", async (Guid boatCategoryId, Guid boatId, AppDb db) =>
{
    var boat = await db.Boats.FindAsync(boatId);
    if (boat is null) return Results.NotFound();

    if (boat.BoatCategoryId != boatCategoryId)
        return Results.BadRequest(new { message = "Boat is not in this category" });

    boat.BoatCategoryId = null;
    await db.SaveChangesAsync();
    return Results.NoContent();
});

// Get boats in a boat category
admin.MapGet("/boat-categories/{boatCategoryId:guid}/boats", async (Guid boatCategoryId, AppDb db) =>
{
    var boats = await db.Boats
        .Where(b => b.BoatCategoryId == boatCategoryId)
        .OrderBy(b => b.Name)
        .ToListAsync();

    return Results.Ok(new { boats });
});

admin.MapGet("/boat/{boatId:guid}/boat-category", async (Guid boatId, AppDb db) =>
{
    var boat = await db.Boats.FindAsync(boatId);
    if (boat is null) return Results.NotFound();
    return Results.Ok(boat.BoatCategoryId);
});

// Create category
admin.MapPost("/category", async (CategoryUpsert dto, AppDb db) =>
{
    var c = new Category { Id = Guid.NewGuid(), GroupId = dto.GroupId, Name = dto.Name, SortOrder = dto.SortOrder, IsRequired = dto.IsRequired };
    db.Categories.Add(c);
    await db.SaveChangesAsync();
    return Results.Created($"/admin/category/{c.Id}", c);
});

// Update category
admin.MapPatch("/category/{id:guid}", async (Guid id, CategoryUpsert dto, AppDb db) =>
{
    var c = await db.Categories.FindAsync(id);
    if (c is null) return Results.NotFound();

    // Only update the fields that are provided
    if (!string.IsNullOrEmpty(dto.Name))
        c.Name = dto.Name;
    if (dto.GroupId != Guid.Empty)
        c.GroupId = dto.GroupId;
    c.SortOrder = dto.SortOrder;
    c.IsRequired = dto.IsRequired;

    await db.SaveChangesAsync();
    return Results.Ok(c);
});

// Delete category
admin.MapDelete("/category/{id:guid}", async (Guid id, AppDb db) =>
{
    var c = await db.Categories.FindAsync(id);
    if (c is null) return Results.NotFound();
    db.Categories.Remove(c);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

// Option groups
admin.MapGet("/category/{categoryId:guid}/option-groups", async (Guid categoryId, AppDb db) =>
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
    return Results.Created($"/admin/option-groups/{g.Id}", g);
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

// Create option for a category (auto-creates default OptionGroup if needed)
admin.MapPost("/category/{categoryId:guid}/options", async (Guid categoryId, OptionCreateForCategoryDto dto, AppDb db) =>
{
    var cat = await db.Categories.FindAsync(categoryId);
    if (cat is null) return Results.NotFound(new { message = "Category not found" });

    // Find or create default OptionGroup for this category
    var optionGroup = await db.OptionGroups
        .FirstOrDefaultAsync(og => og.CategoryId == categoryId && og.Name == "Default");

    if (optionGroup is null)
    {
        optionGroup = new OptionGroup
        {
            Id = Guid.NewGuid(),
            CategoryId = categoryId,
            Name = "Default",
            SelectionType = "single",
            MinSelect = 0,
            MaxSelect = 0,
            SortOrder = 0
        };
        db.OptionGroups.Add(optionGroup);
        await db.SaveChangesAsync();
    }

    // Create the option
    var o = new Option
    {
        id = Guid.NewGuid(),
        OptionGroupId = optionGroup.Id,
        Sku = dto.Sku,
        Label = dto.Label,
        Description = dto.Description,
        Price = dto.PriceDelta,
        ImageUrl = dto.ImageUrl,
        IsDefault = dto.IsDefault,
        IsActive = dto.IsActive,
        SortOrder = dto.SortOrder
    };
    db.Options.Add(o);
    await db.SaveChangesAsync();
    return Results.Created($"/admin/options/{o.id}", o);
});

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
        IsActive = dto.IsActive,
        SortOrder = dto.SortOrder
    };
    db.Options.Add(o);
    await db.SaveChangesAsync();
    return Results.Created($"/admin/options/{o.id}", o);
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
    o.SortOrder = dto.SortOrder;
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

// Debug endpoints (only available in development)
if (app.Environment.IsDevelopment())
{
    // Debug endpoint to create test user
    app.MapPost("/debug/create-admin", async (AppDb db) =>
    {
        var email = "admin@example.com";
        var password = "Password1!";

        // Check if user already exists using only existing columns
        var existingUser = await db.Set<AppUser>()
            .AsNoTracking()
            .Where(u => u.Email == email)
            .Select(u => new { u.Id, u.Email, u.Role })
            .FirstOrDefaultAsync();

        if (existingUser != null)
        {
            return Results.Ok(new { message = "User already exists", email = existingUser.Email });
        }

        // Create new admin user using raw SQL to avoid column mapping issues
        var passwordHash = BCrypt.Net.BCrypt.HashPassword(password);
        var userId = Guid.NewGuid();

        await db.Database.ExecuteSqlRawAsync(
            "INSERT INTO app_user (id, email, password_hash, role) VALUES (@id, @email, @passwordHash, @role)",
            new NpgsqlParameter("id", userId),
            new NpgsqlParameter("email", email),
            new NpgsqlParameter("passwordHash", passwordHash),
            new NpgsqlParameter("role", "admin")
        );

        return Results.Ok(new { message = "Admin user created", email = email, role = "admin", id = userId });
    });

    // Debug endpoint to check user
    app.MapGet("/debug/check-user/{email}", async (string email, AppDb db) =>
    {
        var user = await db.Set<AppUser>()
            .AsNoTracking()
            .Where(u => u.Email == email.ToLowerInvariant())
            .Select(u => new { u.Id, u.Email, u.Role, HasPassword = !string.IsNullOrEmpty(u.PasswordHash) })
            .FirstOrDefaultAsync();

        if (user == null)
        {
            return Results.NotFound(new { message = "User not found" });
        }

        return Results.Ok(user);
    });

    // Debug endpoint to reset admin password
    app.MapPost("/debug/reset-admin-password", async (AppDb db) =>
    {
        var email = "admin@example.com";
        var newPassword = "Password1!";

        // Hash the new password
        var newPasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        Console.WriteLine($"[DEBUG] New password hash for verification: {newPasswordHash}");

        // Update the password using raw SQL
        var rowsAffected = await db.Database.ExecuteSqlRawAsync(
            "UPDATE app_user SET password_hash = @passwordHash WHERE email = @email",
            new NpgsqlParameter("passwordHash", newPasswordHash),
            new NpgsqlParameter("email", email)
        );

        if (rowsAffected == 0)
        {
            return Results.NotFound(new { message = "Admin user not found" });
        }

        // Verify the hash works
        var verificationTest = BCrypt.Net.BCrypt.Verify(newPassword, newPasswordHash);
        Console.WriteLine($"[DEBUG] Password verification test: {verificationTest}");

        return Results.Ok(new
        {
            message = "Admin password reset successfully",
            email = email,
            hashWorks = verificationTest,
            rowsAffected = rowsAffected
        });
    });
}

app.Run();