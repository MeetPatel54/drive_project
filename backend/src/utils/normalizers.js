const normalizeName = (value = "") =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const slugify = (value = "") =>
  normalizeName(value).replace(/\s+/g, "-");

module.exports = {
  normalizeName,
  slugify,
};
