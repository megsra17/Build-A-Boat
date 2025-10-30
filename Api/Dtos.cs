public record LoginRequest(string Email, string Password);
public record PriceRequest(string BoatSlug, Guid[]? SelectedOptions);
public record BoatUpsert(
    string Slug,
    string Name,
    decimal BasePrice,
    int ModelYear,
    string[]? Features,
    string? PrimaryImageUrl,
    string? SecondaryImageUrl,
    string? SideImageUrl,
    string? LogoImageUrl,
    List<Guid>? LayerMediaIds
);
public record DuplicateBoatDto(string NewSlug, string? NewName, int? NewModelYear);
public record GroupUpsert(Guid BoatId, string Name, int SortOrder);
public record GroupDetailDto(Guid id, Guid boatId, string name, int sortOrder, List<CategoryDetailDto> categories);
public record CategoryDetailDto(Guid id, Guid? groupId, string name, int sortOrder, bool isRequired, List<OptionGroupDetailDto> optionsGroups);
public record OptionGroupDetailDto(Guid id, Guid categoryId, string name, string selectionType, int minSelect, int maxSelect, int sortOrder, List<OptionDetailDto> options);
public record OptionDetailDto(Guid id, Guid optionGroupId, string? sku, string label, string? description, decimal price, string? imageUrl, bool isDefault, bool isActive, int sortOrder);
public record CategoryUpsert(Guid GroupId, string Name, int SortOrder, bool IsRequired);
public record BoatCategoryUpsert(string Name, int SortOrder);
public record BoatCategoryRow(Guid Id, string Name, int SortOrder);
public record OptionCreateForCategoryDto(string? Sku, string Label, string? Description, decimal PriceDelta, string? ImageUrl, bool IsDefault, bool IsActive, int SortOrder);
public record MediaCreateFromUrl(string Url, string? Label);
public record MediaCreateDto(string Url, string? Label);
public record OptionGroupUpsert(Guid CategoryId, string Name, string SelectionType, int MinSelect, int MaxSelect, int SortOrder);
public record OptionUpsert(Guid OptionGroupId, string? Sku, string Label, string? Description, decimal PriceDelta, string? ImageUrl, bool IsDefault, bool IsActive, int SortOrder);

public record RoleUpsert(string Name, string Slug);

public record SettingDto(string Key, string Value);

// ===== Auth =====
public record ForgotPasswordRequest(string Email);
public record ResetPasswordRequest(string Token, string NewPassword);

// ===== Users =====
public record UserListRequest(string? Search, int Page = 1, int PageSize = 25);
public record UserListItem(Guid Id, string Email, string? Username, string Role, DateTime CreatedAt);
public record UpsertUser(
    string Email,
    string? Username,
    string? Role,
    string? Password,
    string? FirstName,
    string? LastName,
    string? Timezone,
    string? AvatarUrl
);
