When you log in, pass your specifics once:
python [schedule_importer.py](http://_vscodecontentref_/0) login --host 127.0.0.1 --port 3306 --database SE101_Team_29
That writes host, port, and database to ~/.schedule_session alongside your user/password.
Any time later you want to override just for a session, export env vars before running either tool:
setx SCHEDULE_DB_PORT 3306 (PowerShell) or in a shell set SCHEDULE_DB_PORT=3306; the code will prefer the env var over what’s in the session file.
Re-run the importer and Flask app—both now pick up the same configuration automatically.