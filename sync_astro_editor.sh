#!/usr/bin/bash

rsync -a --delete "$(podman volume inspect website_node_modules --format '{{.Mountpoint}}')/" ./app/node_modules/
