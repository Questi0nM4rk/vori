Feature: vq list
  As a user
  I want to list all notes in a vault
  So that I can see what's in it

  Scenario: List all notes in a vault
    Given a vault with 3 markdown files
    When I run "vq list <vault>"
    Then I see a table with one row per file
    And each row shows the note name, title, and tags

  Scenario: List with --json
    Given a vault with 2 markdown files
    When I run "vq list <vault> --json"
    Then I see a JSON array with one object per file
    And each object has "name", "title", and "tags" fields

  Scenario: Empty vault
    Given an empty vault directory
    When I run "vq list <vault>"
    Then the output is empty (no rows)

  Scenario: Vault path does not exist
    When I run "vq list /does/not/exist"
    Then the exit code is non-zero
    And stderr contains "does not exist"
