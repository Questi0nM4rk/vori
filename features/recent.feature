Feature: vori recent
  As a user
  I want to see recently dated notes
  So that I can review what I've been working on

  Scenario: Default window is 7 days
    Given a vault with notes having "date" frontmatter
    When I run "vori recent <vault>"
    Then I see notes with dates within the last 7 days
    And notes older than 7 days are excluded

  Scenario: Custom window with --days
    When I run "vori recent <vault> --days=30"
    Then I see notes with dates within the last 30 days

  Scenario: Results sorted newest first
    Given two notes dated 3 days ago and 1 day ago
    When I run "vori recent <vault>"
    Then the note dated 1 day ago appears first

  Scenario: Notes without date frontmatter are excluded
    Given a note with no "date" frontmatter field
    When I run "vori recent <vault>"
    Then that note does not appear in the results

  Scenario: --json output
    When I run "vori recent <vault> --json"
    Then the output is a valid JSON array
