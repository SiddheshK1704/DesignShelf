# Hero collage photos

Until a photo is listed here, the landing page shows a duotone placeholder.

1. Put a licence-safe photo in this folder (JPG or WebP, about 900px on the long side).
   Do not use any brand's trademarked imagery.
2. Add an entry to `manifest.json` using one of these slugs:

   stoneware-cup, night-cluster, walnut-sideboard, aluminium-dial, leather-tote,
   grid-poster, knit-speaker, concrete-stair, banking-screen

```json
{
  "images": [
    {
      "slug": "stoneware-cup",
      "file": "stoneware-cup.jpg",
      "credit": "Photographer name",
      "licence": "CC0",
      "sourceUrl": "https://example.com/original"
    }
  ]
}
```

Aspect ratios: stoneware-cup, leather-tote, concrete-stair are 4:5; night-cluster,
aluminium-dial, knit-speaker are 1:1; walnut-sideboard, grid-poster, banking-screen are 3:4.
Photos are cropped to fit, so off-ratio images still work.
