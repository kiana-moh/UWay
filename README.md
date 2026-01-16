Campus Pathfinder – Quick Setup (Team 29)

This project runs a Flask backend and a React map so you can paste your
Quest schedule and see walking routes between classes.

1.  Install the basics

-   Python 3.10+
-   Node 18+
-   Access to a MySQL database (or an SSH tunnel)

3.  Set up your environment file cp .env.example .env Update: 
.env.example is an example of what your env file should look like!! if you can't connect, make sure it's pointing in the right direction. 

-   SCHEDULE_DB_HOST, SCHEDULE_DB_PORT, SCHEDULE_DB_NAME → your MySQL
    info
-   VITE_API_BASE → usually http://localhost:5001/api

4.  Import your Quest schedule Option A – CLI: python
    src/schedule_importer.py login –host –port –database python
    src/schedule_importer.py import -f src/schedule.txt
    ^only if the one on the website doesn't work for some reason. 

Option B – Web app: Start the project, paste your schedule, click Import
Schedule.

5.  Run the app python run_dev.py from Project folder. Open http://localhost:5173 Ctrl+C
    stops everything.

6.  How to use it

-   Select two buildings → Find Path
-   Pick a date → Load Day’s Route
-   Paste a new schedule when needed

Quick fixes - DB errors: check .env - Missing schedule: re-import your
Quest export - Frontend can’t reach backend: confirm VITE_API_BASE

API endpoints GET /api/buildings POST /api/path GET
/api/schedule/travel?date=YYYY-MM-DD POST /api/schedule/import
