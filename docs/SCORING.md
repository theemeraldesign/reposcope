# Repository Health Scoring

Scoring engine version: 0.1.0

RepoScope currently calculates a transparent heuristic health score from GitHub repository metadata. It is an early indicator, not a validated measure of software quality, security, or developer skill.

## Dimensions and weights

| Dimension | Weight |
|---|---:|
| Development activity | 20% |
| Maintenance | 20% |
| Community engagement | 15% |
| Documentation | 15% |
| Issue and pull request management | 15% |
| Dependency health | 15% |

## Current evidence

- Development activity: sampled commits in the last 30, 90, and 180 days.
- Maintenance: time since the latest push, archived status, and GitHub Actions workflow presence.
- Community engagement: stars, forks, and watchers, using logarithmic scaling.
- Documentation: README, docs directory, detected license, and contributing guide.
- Issue and pull request management: sampled open/closed issues and merged pull requests.
- Dependency health: dependency manifest, lockfile, and Dependabot or Renovate configuration.

The engine fetches up to 100 recent commits, issues, and pull requests per analysis. GitHub API failures for optional evidence are treated as unavailable samples, not as proof of poor repository health.

## Interpretation

- Scores are weighted averages of the six dimension scores.
- Each dimension includes evidence in the `score_breakdown` field.
- Findings include a severity, category, title, and actionable detail.
- Snapshot metadata records the scoring version and source repository metadata.
- Scores are point-in-time observations. A new analysis creates a new snapshot.

## Limitations

- The model is heuristic and has not yet been validated against a representative repository dataset.
- Community popularity is not a proxy for code quality.
- The current dependency score checks maintenance signals. It does not compare installed dependencies against current vulnerability advisories or latest versions.
- Issue and pull request management uses a limited sample and does not yet calculate response or resolution times.
- Missing optional GitHub data can affect dimension scores. The UI and reports must show data availability clearly.

Never present the score as a measure of developer skill or intrinsic software quality. AI-generated explanations and recommendations are not part of this deterministic scoring implementation yet.
