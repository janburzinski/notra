import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://usenotra.com",
      lastModified: new Date(),
    },
    {
      url: "https://usenotra.com/privacy",
      lastModified: new Date(),
    },
    {
      url: "https://usenotra.com/terms",
      lastModified: new Date(),
    },
    {
      url: "https://usenotra.com/legal",
      lastModified: new Date(),
    },
  ];
}
