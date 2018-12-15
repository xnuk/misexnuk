#!/usr/bin/env ruby
require 'yaml'
require 'json'

DIR = File.dirname __FILE__
CONFIG_PATH = ARGV[0] || File.join(DIR, 'config.yaml')

abort unless File.exists? CONFIG_PATH

YAML.safe_load(File.read CONFIG_PATH).to_h.each do |key, value|
	File.write(
		File.join(DIR, key),
		JSON.pretty_generate(value, 'indent' => 2) + "\n",
	)
end
