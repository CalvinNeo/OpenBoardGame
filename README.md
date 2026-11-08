This is a toy that I invented to practice my vibe coding skill.

YOU'RE NOT ALLOWED TO USE IT COMMERCIALLY.

python 3.11 is recommended.

## Switching browsers

Choose **Logout → Confirm & Copy Access Key** to disconnect and transfer all saved
room credentials from this browser, not just the current room. In the other
browser, choose **Create Room** or **Join Room**, then select **Access key** in the
name dialog and paste the copied key. This restores access to your previous rooms
without creating a new player. It opens the requested room only if the key grants
access to it; without a requested room, it opens the last available saved room.
Use **Reconnect** in the room list to switch between your
previous rooms, keeping each room's original player, seat, and game state. Normal
**Confirm** keeps the existing logout behavior.

Logout waits for server confirmation before clearing credentials, then opens a
fresh anonymous connection. It also disconnects active seats authenticated by
this browser's saved room credentials and signs out other open tabs in the same
browser. A timeout keeps your credentials and offers a retry instead of reporting
success. Normal logout removes a lobby seat; an ongoing game's seat remains
visible but offline. Copying the access key preserves lobby seats as well.

The key is a snapshot of saved room reconnect credentials at export time; it does
not create an account or add access-key storage. Keep it private. The server also
checks those credentials against existing seats, so a player who was offline when
a game reopened can recover access to the new room even without its room ID in
the key. This requires the same player ID and secret token, never just a matching
name. Previously copied single-room keys work for that room and its retained
seats in reopened rooms; copy a new key to transfer unrelated saved rooms too.
An unavailable room does not prevent restoring the others. If copying fails,
you stay logged in.

## Reconnecting to rooms

The top **Reconnect** targets the displayed room. Each room-list **Reconnect**
targets that specific room, including a finished room that still retains your
seat. Refreshing the list or recovering credentials never switches rooms or
redirects you to the latest game. Switching rooms preserves your other seats and
each game's state. Only one room is active per browser connection at a time.

On connection, list refresh, and room-list updates, the server privately returns
credentials for existing seats authenticated by this browser's saved credentials
or current session. Public room lists contain no reconnect credentials. Logout
and canceled key imports discard pending credential-recovery responses.
