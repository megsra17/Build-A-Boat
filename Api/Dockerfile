# Build stage
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
# copy csproj first for better layer caching
COPY Api.csproj ./
RUN dotnet restore

# copy the rest and publish
COPY . ./
RUN dotnet publish -c Release -o /out

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:9.0
WORKDIR /app
COPY --from=build /out ./

# Railway will inject PORT and (optionally) ASPNETCORE_URLS at runtime.
# Kestrel listens on ASPNETCORE_URLS. If Railway doesn't set it for you,
# set it in the service variables: ASPNETCORE_URLS=http://0.0.0.0:${PORT}
ENTRYPOINT ["dotnet", "Api.dll"]
