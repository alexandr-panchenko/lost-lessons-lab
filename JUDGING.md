# Judging Lost Lessons Lab

## Demo

- URL: **<https://lost-lessons-lab.sanocks.workers.dev>**
- Direct path: `/judge`
- Login: **not required**
- Credentials: **not required**
- User API key: **not required**

## Steps

1. Open `/judge`; wait for the fresh room to load, then select **Student view**.
2. Use the prepared handwritten mistake and press **Run my solution**.
3. Read the GPT-5.6 interpretation, then let the countdown start the bridge simulation.
4. After the comic failure, press **Apply prepared correction**, then press **Run my solution** again.
5. Watch the successful crossing, then press **Replay** on either simulation or reload the page to confirm persistence.

## Expected outcome

The first submission builds a `4.08 m` bridge and fails safely. The second builds a `9 m` bridge and succeeds. The page visibly connects the learner's written value to the physical result and identifies the fraction-conversion error.

## Reset

Use **Reset current task** in the room. Reopening `/judge` always creates a completely new room.

## AI failure fallback

If handwriting analysis fails, use **Enter the value yourself**, enter `4.08`, and press **Run manual value**. Then apply the prepared correction, enter `9`, and press **Run manual value** again. The fallback uses the same real physics scene and deterministic validation.

## Submission release

- Commit: **pending**
- Tag: `build-week-submission` **pending**
