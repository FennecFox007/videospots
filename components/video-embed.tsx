// Shared video embed: auto-detects YouTube, Vimeo, or direct video file URL
// (mp4/webm/mov) and renders the appropriate player. Anything else falls back
// to a plain link.
//
// Used on:
//  - /campaigns/[id] detail page (Video section)
//  - /share/[token] public campaign view
//  - <VideoPlayerModal> opened from timeline play button
//
// Note: we DO want autoplay in modal context but NOT in inline detail page —
// callers can pass `autoplay` to control. Default = no autoplay (safer).

type Props = {
  url: string;
  /** Append autoplay=1 to YouTube/Vimeo iframe srcs and add `autoPlay` to <video>. */
  autoplay?: boolean;
};

export function VideoEmbed({ url, autoplay = false }: Props) {
  const yt = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{11})/
  );
  const vimeo = url.match(/vimeo\.com\/(\d+)/);

  if (yt) {
    const src = `https://www.youtube.com/embed/${yt[1]}${autoplay ? "?autoplay=1" : ""}`;
    return (
      <div className="aspect-video">
        <iframe
          src={src}
          className="w-full h-full rounded"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  if (vimeo) {
    const src = `https://player.vimeo.com/video/${vimeo[1]}${autoplay ? "?autoplay=1" : ""}`;
    return (
      <div className="aspect-video">
        <iframe
          src={src}
          className="w-full h-full rounded"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  if (/\.(mp4|webm|mov)(\?.*)?$/i.test(url)) {
    return (
      <video
        src={url}
        controls
        autoPlay={autoplay}
        className="w-full rounded aspect-video"
      />
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:underline break-all"
    >
      {url}
    </a>
  );
}
