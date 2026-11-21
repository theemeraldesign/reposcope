create index github_installations_user_id_idx on public.github_installations(user_id);
create index analysis_runs_requested_by_idx on public.analysis_runs(requested_by);
create index reports_analysis_run_id_idx on public.reports(analysis_run_id);
create index reports_repository_id_idx on public.reports(repository_id);
