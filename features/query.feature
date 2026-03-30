Feature: vq query
  As a user
  I want to filter notes by frontmatter tags or hashtags
  So that I can find specific notes quickly

  Scenario: Filter by frontmatter tag (exact match)
    Given a vault with notes having various frontmatter
    When I run "vq query <vault> --tag status=draft"
    Then I only see notes where frontmatter.status equals "draft"

  Scenario: Filter by multiple tags (AND semantics)
    Given a vault with notes
    When I run "vq query <vault> --tag status=draft --tag type=idea"
    Then I only see notes matching BOTH conditions

  Scenario: Filter by hashtag (case-insensitive)
    Given a vault with notes containing #TypeScript and #typescript
    When I run "vq query <vault> --hashtag typescript"
    Then I see both notes

  Scenario: Dot notation for nested frontmatter
    Given a note with frontmatter "meta.priority: high"
    When I run "vq query <vault> --tag meta.priority=high"
    Then that note appears in the results

  Scenario: No matches
    When I run "vq query <vault> --tag status=nonexistent"
    Then the output is empty
