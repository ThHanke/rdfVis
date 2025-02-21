# rdfVis
pure js and html graph visualization for rdf resources using vis-networlk, rdflib and bootstrap

https://thhanke.github.io/rdfVis/
# how to

## load data
You can load graph data through file upload, public url of sparql endpoint query using the sidebar.

You can also use parameters for reading turtle files on the web.
Examples:
    https://thhanke.github.io/rdfVis/?source=https://raw.githubusercontent.com/Mat-O-Lab/IOFMaterialsTutorial/refs/heads/main/sieving_ASTM_B214-07.ttl
or sparql endpoints:
    https://thhanke.github.io/rdfVis/?sparql=https://kit-pmd-4.ydns.eu/fuseki/471fcf11-3797-42b2-95e1-c04f20411be8

## interactions

- double left click on clusters to unfold them
- right click to attempt to fold a node into cluster (outgoing connections of node must exceed 3)
- double click on a node to hide nodes that are connected by outgoing connections and are not connected to other nodes in the branch,
  the node is marked with '[+]'
- double click on a node to unhide the connected nodes again
