#!/usr/bin/env sh
run_node() {

echo `node /home/explne/kurt/kurt.js "$1" "$2" "$3" "$4"` 

}

usr=""

pass=""

dt=$(date +%F)

newdt=$(date --date='4 days' +%F)

run_node $usr $pass $dt $newdt
