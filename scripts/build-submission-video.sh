#!/usr/bin/env bash
set -euo pipefail

raw_clip="$(find .tmp/submission-video/raw -maxdepth 1 -type f -name '*.webm' -print -quit)"
thumbnail="docs/evidence/m9/submission-thumbnail.png"
collaboration_capture="docs/evidence/m3/realtime-layers.png"
narration_text="docs/evidence/m9/video-narration.txt"
captions="docs/evidence/m9/video-captions.srt"
working_directory=".tmp/submission-video/final"
output_directory="artifacts/submission"
output_video="${output_directory}/lost-lessons-lab-demo.mp4"
output_captions="${output_directory}/lost-lessons-lab-demo.en.srt"
narration_audio="${working_directory}/narration.wav"

if [[ -z "${raw_clip}" ]]; then
  echo "No raw production capture found. Run bun run capture:video:draft first." >&2
  exit 1
fi

for required_file in \
  "${thumbnail}" \
  "${collaboration_capture}" \
  "${narration_text}" \
  "${captions}"; do
  if [[ ! -f "${required_file}" ]]; then
    echo "Missing required media source: ${required_file}" >&2
    exit 1
  fi
done

for required_command in espeak-ng ffmpeg ffprobe; do
  if ! command -v "${required_command}" >/dev/null 2>&1; then
    echo "Missing required media command: ${required_command}" >&2
    exit 1
  fi
done

mkdir -p "${working_directory}" "${output_directory}"

espeak-ng \
  -v en-us+f3 \
  -s 165 \
  -p 48 \
  -a 155 \
  -w "${narration_audio}" \
  -f "${narration_text}"

ffmpeg -hide_banner -loglevel warning -y \
  -loop 1 -t 5 -i "${thumbnail}" \
  -i "${raw_clip}" \
  -loop 1 -t 7 -i "${collaboration_capture}" \
  -loop 1 -t 5 -i "${thumbnail}" \
  -i "${narration_audio}" \
  -i "${captions}" \
  -filter_complex "
    [0:v]scale=1280:720:force_original_aspect_ratio=decrease,
      pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x0f3158,
      setsar=1,fps=30,format=yuv420p,
      trim=duration=5,setpts=PTS-STARTPTS,
      fade=t=out:st=4.5:d=0.5[title];
    [1:v]scale=1280:720:force_original_aspect_ratio=increase,
      crop=1280:720,setsar=1,fps=30,format=yuv420p,
      setpts=1.246*PTS,
      fade=t=in:st=0:d=0.5,
      fade=t=out:st=91.45:d=0.5[demo];
    [2:v]scale=1280:720:force_original_aspect_ratio=decrease,
      pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0xfff8e8,
      setsar=1,fps=30,format=yuv420p,
      trim=duration=7,setpts=PTS-STARTPTS+68/TB[collaboration];
    [3:v]scale=1280:720:force_original_aspect_ratio=decrease,
      pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x0f3158,
      setsar=1,fps=30,format=yuv420p,
      trim=duration=5,setpts=PTS-STARTPTS,
      fade=t=in:st=0:d=0.5[end];
    [title][demo][end]concat=n=3:v=1:a=0[base];
    [base][collaboration]overlay=eof_action=pass:enable='between(t,68,75)'[v];
    [4:a]apad=pad_dur=2[a]
  " \
  -map "[v]" \
  -map "[a]" \
  -map 5:0 \
  -c:v libx264 \
  -preset medium \
  -crf 20 \
  -c:a aac \
  -b:a 160k \
  -c:s mov_text \
  -metadata title="Lost Lessons Lab — Build Week demo" \
  -metadata:s:s:0 language=eng \
  -movflags +faststart \
  -t 101.95 \
  "${output_video}"

ffprobe -v error \
  -show_entries format=duration,size:stream=index,codec_name,codec_type,width,height \
  -of json \
  "${output_video}"

cp "${captions}" "${output_captions}"

echo "Draft video written to ${output_video}"
echo "Caption sidecar written to ${output_captions}"
