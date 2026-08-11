export const setupSite = () => {
  const page = document.body.dataset.page;
  document.querySelectorAll(`[data-nav="${page}"]`).forEach((link) => link.setAttribute("aria-current", "page"));
};

export const downloadText = (filename, content, type = "text/plain;charset=utf-8") => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
