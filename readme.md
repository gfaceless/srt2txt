# srt2txt: convert subtitle to normal text
remove timestamps, concat sentences. Support only .srt files.

# Install and use
```
npm i -g srt2txt`
s2t subtitle.srt > output.txt
```

TODO: handle `...` at the end of a sentence. (most likely it is a pause)