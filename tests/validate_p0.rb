#!/usr/bin/env ruby

require "csv"
require "yaml"

ROOT = File.expand_path("..", __dir__)
RULES_PATH = File.join(ROOT, "config", "rules.yaml")
EXAMPLES_PATH = File.join(ROOT, "tests", "rule_examples.csv")

rules = YAML.safe_load(File.read(RULES_PATH), aliases: true)
examples = CSV.read(EXAMPLES_PATH, headers: true)

required_sections = %w[
  version
  universe
  candidate
  setup_classification
  market_regime_D1
  D1_intraday_entry
  risk_and_position_sizing
  D1_hold_or_exit
  D2_plus_reclaim_watch
  transaction_costs
  backtest
  resolved_decisions
]

missing_sections = required_sections - rules.keys
raise "Missing YAML sections: #{missing_sections.join(', ')}" unless missing_sections.empty?
raise "Expected 10 manual cases, got #{examples.size}" unless examples.size == 10

case_ids = examples.map { |row| row.fetch("case_id") }
raise "Duplicate case_id found" unless case_ids.uniq.size == case_ids.size

examples.each do |row|
  expected_stop = [
    row.fetch("d_minus_1_close").to_f,
    row.fetch("d0_open").to_f
  ].max
  actual_stop = row.fetch("expected_stop_price").to_f

  unless (expected_stop - actual_stop).abs < 0.0001
    raise "#{row.fetch('case_id')}: stop #{actual_stop} != #{expected_stop}"
  end

  volume_ratio = row.fetch("d1_volume_ratio").to_f
  expected_watch = row.fetch("expected_reclaim_watch") == "true"
  volume_qualifies = volume_ratio >= 1.5 && volume_ratio <= 2.0

  if expected_watch && !volume_qualifies
    raise "#{row.fetch('case_id')}: reclaim watch has invalid D1 volume ratio"
  end

  if row.fetch("is_currently_disposed") == "true" &&
     row.fetch("expected_candidate") != "false"
    raise "#{row.fetch('case_id')}: disposed stock cannot be a candidate"
  end
end

raise "V1 status is not locked" unless rules.fetch("status") == "locked_v1"

fallback = rules.dig("candidate", "liquidity", "fallback_activation")
unless fallback.fetch("event_backtest_action") == "include_all_qualifying_fallback_candidates" &&
       fallback.fetch("live_notification_max_candidates") == 5
  raise "Fallback candidate decision is not locked"
end

unless rules.dig("D2_plus_reclaim_watch", "invalidation_price", "formula") ==
       "max_D1_low_and_D0_low"
  raise "D2+ invalidation decision is not locked"
end

no_chase = rules.dig("D1_intraday_entry", "no_chase_rule")
unless no_chase.fetch("D1_open_gap_gt_0_05_lte_0_07") ==
       "pullback_confirmation_only" &&
       no_chase.fetch("D1_open_gap_gt_0_07") == "reject_D1_intraday_entry"
  raise "D1 gap decision is not locked"
end

puts "rules_version=#{rules.fetch('version')}"
puts "rules_status=#{rules.fetch('status')}"
puts "top_level_sections=#{rules.keys.size}"
puts "resolved_decisions=#{rules.fetch('resolved_decisions').size}"
puts "manual_cases=#{examples.size}"
puts "validation=PASS"
