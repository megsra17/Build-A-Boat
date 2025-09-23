public record LoginRequest(string Email, string Password);
public record PriceRequest(string BoatSlug, Guid[]? SelectedOptions);
public record BoatUpsert(string Slug, string Name, decimal BasePrice, int? ModelYear);
public record CategoryUpsert(Guid BoatId, string Name, int SortOrder, bool IsRequired);
public record OptionGroupUpsert(Guid CategoryId, string Name, string SelectionType, int MinSelect, int MaxSelect, int SortOrder);
public record OptionUpsert(Guid OptionGroupId, string? Sku, string Label, string? Description, decimal PriceDelta, string? ImageUrl, bool IsDefault, bool IsActive, int SortOrder);

// ===== Auth =====
public record ForgetPasswordRequest(string Email);
public record ResetPasswordRequest(string Token, string NewPassword);

// ===== Users =====
public record UserListRequest(string? Search, int Page = 1, int PageSize = 25);
public record UserListItem(Guid Id, string Email, string? Username, string Role, DateTime CreatedAt, DateTime UpdatedAt);
public record UpsertUser(string Email, string? Username, string Role, string? Password);

