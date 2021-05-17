#!/bin/bash

#Naive and barebone startup script for node

echo "Push recieved running script"

killall node #Kill every old instance of node


#Goto working dir
cd "$(dirname "$0")"


#npm install #install dependencies from package.json (pro-tip use auto-install to keep this in sync)

# Start node js
npm start #rename this if you want to run something else