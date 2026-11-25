# Recipes

Each recipe is one Markdown file in this folder. The build script turns these
files into the pages under `/recipes/`.

## Add a recipe

1. Copy `_template.md` to a new file. The file name becomes the URL, so
   `crispy-chickpea-grain-bowls.md` is published at
   `/recipes/lunch/crispy-chickpea-grain-bowls/`.
2. Fill it in. Delete `draft: true` when it's ready to publish.
3. Build:

   ```sh
   node scripts/build-recipes.mjs
   ```

4. Preview locally:

   ```sh
   python3 -m http.server 8000
   # open http://localhost:8000/recipes/
   ```

5. Commit everything, including the generated `recipes/` folder, and push.

Run with `--drafts` to preview drafts locally. Don't push a build made with
`--drafts`. Note that these source files, drafts included, are publicly
readable on GitHub Pages at `/_recipes/…`.

## Front matter

| Field         | Required | Example                          | Notes |
|---------------|----------|----------------------------------|-------|
| `title`       | yes      | `Sheet-Pan Lemon Garlic Chicken` | |
| `category`    | yes      | `dinner`                         | `breakfast`, `lunch`, `dinner`, `snacks`, or `desserts` |
| `description` |          | `Crisp skin, lemony potatoes.`   | Card text, search, and link previews |
| `date`        |          | `2026-11-24`                     | Newest recipes appear first |
| `prep`        |          | `15 min`                         | Times can be `45 min`, `1 hr 15 min`, `1h15m`, or `75`. Any other text, like `overnight`, is shown as written |
| `cook`        |          | `1 hr`                           | |
| `rest`        |          | `2 hr`                           | Chilling, rising, marinating |
| `total`       |          | `3 hr`                           | Calculated from prep + cook + rest unless you set it |
| `active`      |          | `About 3½ hr`                    | Hands-on time, for long projects (use instead of `prep`) |
| `servings`    |          | `4`                              | Turns on the servings scaler |
| `yield`       |          | `18 cookies` or `1 loaf`         | Without `servings`, the scaler counts the yield instead |
| `scale`       |          | `false`                          | Hides the scaler (fixed-size pans, layered cakes) |
| `oven`        |          | `375°F, 350°F`                   | Shown with the times |
| `image`       |          | `/assets/recipes/my-recipe.jpg`  | Shown beside the title, cropped to 4:5, and on cards at 4:3. Without one, the card shows category art |
| `image-alt`   |          | `Golden chicken in a pan`        | Defaults to the title |
| `image-position` |       | `50% 40%`                        | Which part of the photo to keep when it's cropped |
| `cuisine`     |          | `Japanese-inspired`              | Search engines only |
| `tags`        |          | `weeknight, one pan`             | Comma-separated. Also searchable |
| `affiliate`   |          | `true`                           | Shows the Amazon Associates disclosure under the title |
| `draft`       |          | `true`                           | Skipped unless you build with `--drafts` |

Times with extra words, like `About 11 hr, over 2 days`, are shown exactly as
written.

Keep photos in `/assets/recipes/`. The build clears the category folders under
`/recipes/` every time, so anything else saved there gets deleted.

## Body

- **Intro**: any text before the first `##` heading.
- **`## Ingredients`** (or `## Shopping list`): one `- ` bullet per ingredient.
  `### Subheads` split it into groups like "For the dressing". Plain lines
  become small notes.
  - The scaler multiplies the number at the start of each line: `2`, `1 1/2`,
    `½`, `2-3`, `1/2 to 1`.
  - It also scales weights in parentheses, like `(113g)` or `(8 oz)`. Can
    sizes like `(15-oz)` are left alone.
- **`## Steps`** (or `Method`/`Instructions`/`Directions`): numbered lists.
  - Each step shows the number you wrote. Writing `1.` again after a heading
    restarts the count, and `4.` continues it.
  - For a simple recipe, `### Subheads` group the steps.
  - For a project, use `### Day 1` for stages and `#### 1. Roast the
    potatoes` for components. Components get numbered badges and can be
    linked as `#step-1`.
  - Inside the steps you can use per-component ingredient tables,
    `**You'll need:**` lines, `> **Tip:**` boxes, and photos.
- **Other `##` sections** keep their place on the page:
  - Sections *before* the ingredients (layers, equipment, schedule) appear
    above the recipe, with a "Jump to recipe" button.
  - Sections *after* the steps appear below the method. A section called
    `## Notes` gets a highlighted box.
  - With three or more extra sections, an "On this page" menu appears.
  - Each section can be linked as `#section-title`, for example
    `[Variations](#variations)`.
- **Inside any section**: `| tables |`, images on their own line
  (`![Alt text](/assets/recipes/photo.jpg)`), an `*italic line*` right after
  an image as its caption, an `*italic line*` right after a heading as its
  time note, `### subheads`, and lists.
- **Inline formatting** works everywhere: `**bold**`, `*italic*`,
  `[link](https://…)`. Amazon links with `?tag=…` automatically get
  `rel="sponsored"` and open in a new tab.
- **Printing** gives the recipe card: title, times, ingredients, steps with
  their tables, and Notes. Reference sections and photos stay on the web page.

## Security

Every page carries a Content Security Policy (a `<meta>` tag in `<head>`). It
only allows scripts, styles, and images from jncybr.com itself. So:

- Don't add `style="…"` attributes, inline `<script>` tags, or `onclick`
  handlers. They won't run. Put styles in `/styles.css` or
  `recipes/recipes.css`.
- Photos must live on this site, in `/assets/recipes/`. Images hotlinked from
  other sites won't load.
- If you add a new hand-written page, copy the two `<meta>` lines after
  `viewport` from `/index.html`.
