const fs = require("fs");
const path = require("path");

module.exports = function (eleventyConfig) {
  // Static assets copied as-is into the built site
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/images");
  eleventyConfig.addPassthroughCopy("src/admin");

  // ---- Scheduled publishing ----
  // Articles dated in the future are skipped entirely at build time.
  // They appear on the first build after their date has passed.
  (function skipFutureArticles() {
    const dir = "src/articles";
    let files = [];
    try {
      files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
    } catch (e) {
      return;
    }
    const now = Date.now();
    files.forEach((f) => {
      const text = fs.readFileSync(path.join(dir, f), "utf8");
      const head = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!head) return;
      const m = head[1].match(/^date:\s*["']?([^"'\r\n]+?)["']?\s*$/m);
      if (!m) return;
      const t = Date.parse(m[1]);
      if (!Number.isNaN(t) && t > now) {
        eleventyConfig.ignores.add(path.posix.join(dir, f));
      }
    });
  })();

  // ---- helpers ----
  const asList = (v) => {
    if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
    if (typeof v === "string") return v.split(",").map((x) => x.trim()).filter(Boolean);
    return [];
  };
  const topicSlug = (s) =>
    String(s)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  // Article collection, newest first
  eleventyConfig.addCollection("articles", function (collectionApi) {
    return collectionApi.getFilteredByGlob("src/articles/*.md").sort((a, b) => {
      return b.data.date - a.data.date;
    });
  });

  // Sections (departments): created in the dashboard as files in src/sections
  const sectionSort = (a, b) => {
    const ao = Number(a.data.order ?? 100);
    const bo = Number(b.data.order ?? 100);
    if (ao !== bo) return ao - bo;
    return String(a.data.title || "").localeCompare(String(b.data.title || ""));
  };
  eleventyConfig.addCollection("sections", function (api) {
    return api.getFilteredByGlob("src/sections/*.md").sort(sectionSort);
  });
  eleventyConfig.addCollection("navSections", function (api) {
    return api
      .getFilteredByGlob("src/sections/*.md")
      .filter((s) => s.data.show_in_nav !== false)
      .sort(sectionSort);
  });

  // Tags: collected automatically from the "topics" field of every article
  eleventyConfig.addCollection("topicList", function (api) {
    const map = new Map();
    api.getFilteredByGlob("src/articles/*.md").forEach((item) => {
      asList(item.data.topics).forEach((name) => {
        const slug = topicSlug(name);
        if (!slug) return;
        if (!map.has(slug)) map.set(slug, { slug, name, count: 0 });
        map.get(slug).count++;
      });
    });
    return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  });

  // Filters
  eleventyConfig.addFilter("asList", asList);
  eleventyConfig.addFilter("topicSlug", topicSlug);
  eleventyConfig.addFilter("inSection", function (articles, slug) {
    return (articles || []).filter((a) => asList(a.data.sections).includes(slug));
  });
  eleventyConfig.addFilter("withTopic", function (articles, slug) {
    return (articles || []).filter((a) => asList(a.data.topics).some((t) => topicSlug(t) === slug));
  });

  // Put the featured article first (newest featured wins), keep the rest in order
  eleventyConfig.addFilter("leadFirst", function (arr) {
    const all = arr || [];
    const lead = all.find((item) => item.data && item.data.featured);
    if (!lead) return all;
    return [lead, ...all.filter((item) => item.url !== lead.url)];
  });

  // Human-readable date, e.g. "23 September 2026"
  eleventyConfig.addFilter("readableDate", function (dateObj) {
    const d = new Date(dateObj);
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  });

  // Today's date at build time, for the masthead dateline
  eleventyConfig.addGlobalData("buildDate", () => new Date());

  // Older helper, no longer used by the front page
  eleventyConfig.addFilter("frontPage", function (arr) {
    const all = arr || [];
    const lead = all.find((item) => item.data && item.data.featured) || all[0] || null;
    const secondaries = all.filter((item) => !lead || item.url !== lead.url).slice(0, 3);
    return { lead, secondaries };
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["njk", "md", "html"],
  };
};
