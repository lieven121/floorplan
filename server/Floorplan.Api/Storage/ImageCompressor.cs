using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;

namespace Floorplan.Api.Storage;

/// <summary>Shrinks an image until its JPEG encoding fits in a byte budget.</summary>
public static class ImageCompressor
{
    private static readonly int[] Qualities = [85, 75, 65, 55];
    private const double ScaleStep = 0.75;
    private const int MinSide = 256;
    /// <summary>Refuse to decode bigger images (about 1 GB of RAM as RGBA).</summary>
    public const long MaxPixels = 250_000_000;

    /// <summary>True when the stream starts like an image ImageSharp can read. Rewinds the stream.</summary>
    public static async Task<ImageInfo?> IdentifyAsync(Stream input, CancellationToken ct)
    {
        try
        {
            return await Image.IdentifyAsync(input, ct);
        }
        catch (Exception ex) when (ex is UnknownImageFormatException or InvalidImageContentException or NotSupportedException)
        {
            return null;
        }
        finally
        {
            input.Position = 0;
        }
    }

    /// <summary>
    /// Re-encodes as JPEG, stepping the quality down, then the size down by 25% at a time, until the
    /// result is at most <paramref name="maxBytes"/>. Returns null when even the smallest step is too big.
    /// </summary>
    public static async Task<MemoryStream?> CompressAsync(Stream input, long maxBytes, CancellationToken ct)
    {
        using var image = await Image.LoadAsync(input, ct);
        image.Mutate(x => x.AutoOrient());
        // Orientation is applied; the rest of the metadata (EXIF thumbnails, XMP) only costs bytes.
        image.Metadata.ExifProfile = null;
        image.Metadata.XmpProfile = null;
        image.Metadata.IccProfile = null;

        int width = image.Width, height = image.Height;
        var scale = 1.0;
        while (true)
        {
            using var frame = scale < 1
                ? image.Clone(x => x.Resize(Math.Max(1, (int)(width * scale)), Math.Max(1, (int)(height * scale))))
                : null;
            var target = frame ?? image;

            foreach (var quality in Qualities)
            {
                ct.ThrowIfCancellationRequested();
                var ms = new MemoryStream();
                await target.SaveAsJpegAsync(ms, new JpegEncoder { Quality = quality }, ct);
                if (ms.Length <= maxBytes)
                {
                    ms.Position = 0;
                    return ms;
                }
                await ms.DisposeAsync();
            }

            scale *= ScaleStep;
            if (Math.Max(width, height) * scale < MinSide) return null;
        }
    }
}
