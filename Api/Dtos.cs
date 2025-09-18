public record LoginRequest(string Email, string Password);
public record PriceRequest(string BoatSlug, Guid[]? SelectedOptions);
public record BoatUpsert(string Slug, string Name, decimal BasePrice, int? ModelYear);
public record CategoryUpsert(Guid BoatId, string Name, int SortOrder, bool IsRequired);
public record OptionGroupUpsert(Guid CategoryId, string Name, string SelectionType, int MinSelect, int MaxSelect, int SortOrder);
public record OptionUpsert(Guid OptionGroupId, string? Sku, string Label, string? Description, decimal PriceDelta, string? ImageUrl, bool IsDefault, bool IsActive, int SortOrder);

public record ForgetPasswordRequest(string Email);
public record ResetPasswordRequest(string Token, string NewPassword);
