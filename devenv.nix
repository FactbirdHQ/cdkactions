{pkgs, ...}: {
  languages.javascript = {
    enable = true;
    bun.enable = true;
  };

  env.TREEFMT_NO_CACHE = "true";

  git-hooks.hooks.treefmt.enable = true;

  treefmt = {
    enable = true;
    config.programs.biome.enable = true;
    config.programs.biome.formatCommand = "format";
    config.programs.biome.settings = {
      formatter = {
        indentStyle = "space";
        lineWidth = 120;
      };
      javascript.formatter = {
        quoteStyle = "single";
      };
    };
    config.programs.alejandra.enable = true;
    config.programs.yamlfmt.enable = true;
    config.programs.yamlfmt.settings = {
      formatter = {
        retain_line_breaks = true;
      };
    };
  };
}
