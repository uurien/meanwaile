Start Meanwaile in development mode:

1. Run `npm run build` in /Users/ugaitz.urien/github.com/uurien/meanwaile to compile TypeScript. If it fails, show the errors and stop.

2. Kill any existing Meanwaile process: `pkill -f "electron \." 2>/dev/null || true`

3. Launch the app in the background: `npx electron . &` from the project directory.

4. Wait 3 seconds, then confirm the HTTP server is up:
   `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3821/hook -H 'Content-Type: application/json' -d '{}'`
   
   Expected: `200`. If not, show what went wrong.

5. Report: app is running, HTTP hook server is listening on port 3821. Remind the user they can send a test hook with:
   ```
   curl -X POST http://localhost:3821/hook \
     -H 'Content-Type: application/json' \
     -d '{"hook_event_name":"Notification","notification_type":"permission_prompt","message":"Test alert","session_id":"dev"}'
   ```
