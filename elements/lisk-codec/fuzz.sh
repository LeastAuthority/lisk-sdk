#!/usr/bin/env bash
jsfuzz ./src/codec_fuzz.js -dir ./corpus | tee -a --output-error='warn' ./codec_fuzz.log
