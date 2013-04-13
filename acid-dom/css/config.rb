# Require any additional compass plugins here.
require "compass-normalize"

# Environment settings
environment = :production
# environment = :development

# Configuration
http_path = "/"
css_dir = "."
sass_dir = "."
images_dir = "../img"
javascripts_dir = "../js"

# Other settings
output_style = (environment == :production) ? :compressed : :expanded
relative_assets = true
line_comments = false
