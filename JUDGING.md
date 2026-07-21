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
4. After the comic failure, correct `0.34` to `0.75` and submit again.
5. Watch the successful crossing, then press **Replay** on either simulation or reload the page to confirm persistence.

## Expected outcome

The first submission builds a `4.08 m` bridge and fails safely. The second builds a `9 m` bridge and succeeds. The page visibly connects the learner's written value to the physical result and identifies the fraction-conversion error.

## Reset

Use **Reset current task** in the room. Reopening `/judge` always creates a completely new room.

## AI failure fallback

If handwriting analysis fails, choose **Enter the bridge length manually**, enter `4.08`, run the failure, then enter `9` and run the success. The fallback uses the same real physics scene and deterministic validation.

## Submission release

- Commit: **pending**
- Tag: `build-week-submission` **pending**
