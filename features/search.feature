Feature: vq search
  As a user
  I want to search note content by keyword
  So that I can find notes without knowing their frontmatter

  Scenario: Search matches note title
    Given a vault containing a note titled "My Project Plan"
    When I run "vq search <vault> project"
    Then that note appears in the results

  Scenario: Search matches frontmatter values
    Given a note with frontmatter "author: alice"
    When I run "vq search <vault> alice"
    Then that note appears in the results

  Scenario: Search matches body content
    Given a note with body text "This is a refactoring idea"
    When I run "vq search <vault> refactoring"
    Then that note appears in the results

  Scenario: Search is case-insensitive
    When I run "vq search <vault> PROJECT"
    Then results match the same notes as "vq search <vault> project"

  Scenario: No matches
    When I run "vq search <vault> xyzzy"
    Then the output is empty
