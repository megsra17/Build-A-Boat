using Amazon.S3;
using Amazon.S3.Model;

public interface IS3Service
{
    Task<string> UploadFileAsync(IFormFile file, string? folder = null);
    Task<bool> DeleteFileAsync(string fileUrl);
    Task<List<string>> ListFoldersAsync(string? prefix = null);
    Task<List<(string Key, string Url)>> ListFilesInFolderAsync(string folderPath);
}

public class S3Service : IS3Service
{
    private readonly IAmazonS3 _s3Client;
    private readonly string _bucketName;

    public S3Service(IAmazonS3 s3Client)
    {
        _s3Client = s3Client;
        _bucketName = Environment.GetEnvironmentVariable("AWS_S3_BUCKET")
            ?? throw new InvalidOperationException("AWS_S3_BUCKET environment variable is required");
    }

    public async Task<string> UploadFileAsync(IFormFile file, string? folder = null)
    {
        var key = folder != null
            ? $"{folder}/{Guid.NewGuid()}_{file.FileName}"
            : $"{Guid.NewGuid()}_{file.FileName}";

        var request = new PutObjectRequest
        {
            BucketName = _bucketName,
            Key = key,
            InputStream = file.OpenReadStream(),
            ContentType = file.ContentType,
            ServerSideEncryptionMethod = ServerSideEncryptionMethod.AES256
        };

        await _s3Client.PutObjectAsync(request);

        // Use CloudFront URL if configured, otherwise fall back to S3 direct URL
        var cloudFrontDomain = Environment.GetEnvironmentVariable("CLOUDFRONT_DOMAIN");
        if (!string.IsNullOrEmpty(cloudFrontDomain))
        {
            return $"https://{cloudFrontDomain}/{key}";
        }

        // Fallback to direct S3 URL
        var region = Environment.GetEnvironmentVariable("AWS_REGION") ?? "us-east-1";
        return $"https://{_bucketName}.s3.{region}.amazonaws.com/{key}";
    }

    public async Task<bool> DeleteFileAsync(string fileUrl)
    {
        try
        {
            var uri = new Uri(fileUrl);
            var key = uri.AbsolutePath.TrimStart('/');

            await _s3Client.DeleteObjectAsync(_bucketName, key);
            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task<List<string>> ListFoldersAsync(string? prefix = null)
    {
        try
        {
            var request = new ListObjectsV2Request
            {
                BucketName = _bucketName,
                Prefix = prefix,
                Delimiter = "/"
            };

            var response = await _s3Client.ListObjectsV2Async(request);
            return response.CommonPrefixes.ToList();
        }
        catch
        {
            return new List<string>();
        }
    }

    public async Task<List<(string Key, string Url)>> ListFilesInFolderAsync(string folderPath)
    {
        try
        {
            var request = new ListObjectsV2Request
            {
                BucketName = _bucketName,
                Prefix = folderPath.EndsWith("/") ? folderPath : folderPath + "/",
                Delimiter = "/"
            };

            var response = await _s3Client.ListObjectsV2Async(request);
            var region = Environment.GetEnvironmentVariable("AWS_REGION") ?? "us-east-1";
            var cloudFrontDomain = Environment.GetEnvironmentVariable("CLOUDFRONT_DOMAIN");

            return response.S3Objects.Select(obj =>
            {
                var url = !string.IsNullOrEmpty(cloudFrontDomain)
                    ? $"https://{cloudFrontDomain}/{obj.Key}"
                    : $"https://{_bucketName}.s3.{region}.amazonaws.com/{obj.Key}";
                return (obj.Key, url);
            }).ToList();
        }
        catch
        {
            return new List<(string, string)>();
        }
    }
}