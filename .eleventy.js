module.exports = function (eleventyConfig) {
  // Static assets copied as-is into the built site
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/images");
  eleventyConfig.addPassthroughCopy("src/admin");

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

  // Given the full articles collection, return { lead, secondaries }.
  // Lead = the article marked featured: true, or the most recent one.
  // Secondaries = the next 4 most recent, excluding the lead.
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
