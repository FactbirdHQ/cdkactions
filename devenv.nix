{pkgs, ...}: {
  packages = [pkgs.act];

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
    # treefmt-nix only knows the schemas of Biome 1.x and 2.3.x and falls back
    # to 2.1.2 for anything else, which rejects options 2.4 accepts. The schema
    # shipped in the Biome source always matches pkgs.biome.
    config.programs.biome.validate.schema = "${pkgs.biome.src}/packages/@biomejs/biome/configuration_schema.json";
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
