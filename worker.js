// worker.js
// Define window as self so rdflib finds a global window.
var window = self;
importScripts("https://cdn.jsdelivr.net/npm/rdflib@2.2.4/dist/rdflib.min.js");

var store = $rdf.graph();
var knownPrefixes = {
  base: "http://local.file/",
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  xsd: "http://www.w3.org/2001/XMLSchema#"
};
const COLOR_PALETTE = [
  '#FFB3BA',  // Pastellrot
  '#FFDFBA',  // Pastellorange
  '#FFFFBA',  // Pastellgelb
  '#BAFFC9',  // Pastellgrün
  '#BAE1FF',  // Pastellblau
  '#E6BEFF',  // Pastelllila
  '#F4C2C2',  // Babyrosa
  '#FFDEAD',  // Navajo-Weiß
  '#FFFACD',  // Zitronenschale
  '#E0FFFF',  // Hellzyan
  '#D8BFD8',  // Flieder
  '#FFC0CB',  // Pink
  '#F5F5DC',  // Beige
  '#D3FFCE',  // Teagrün
  '#E0B0FF',  // Malve
  '#F0E68C',  // Khaki
  '#FFDAB9',  // Pfirsich
  '#E6E6FA',  // Lavendel
  '#FFF0F5',  // Lavendelblush
  '#F5DEB3',  // Weizen
]
// const COLOR_PALETTE = [
//     "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
//     "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
//     "#aec7e8", "#ffbb78", "#98df8a", "#ff9896", "#c5b0d5",
//     "#c49c94", "#f7b6d2", "#c7c7c7", "#dbdb8d", "#9edae5",
//     "#393b79", "#637939", "#8c6d31", "#843c39", "#7b4173",
//     "#5254a3", "#8ca252", "#bd9e39", "#ad494a", "#a55194"
//   ];
var generatedPrefixCounter = 1;
			
function parseRDFInWorker(data, baseUrl, contentType) {
  return new Promise(function(resolve, reject) {
    store = $rdf.graph();
    $rdf.parse(data, store, baseUrl, contentType, function(err) {
      if (err) {
        reject("Error parsing RDF: " + err);
      } else {
        try {
          var prefixMapping = extractPrefixesFromStore(store);
          console.log(prefixMapping)
          var network = buildGraphFromStore(store,prefixMapping);
          // Assign colors and get the prefix color mapping.
          var prefixColorMapping = assignColorsToNodes(network.nodes, prefixMapping);
          resolve({
            network,
            prefixColorMapping
          });
        } catch (ex) {
          reject("Error building graph: " + ex);
        }
      }
    });
  });
}

function getNodeId(node) {
  if (node.termType === 'NamedNode') {
    return node.value;
  } else if (node.termType === 'BlankNode') {
    return "blank" + node.id;
  } else if (node.termType === 'Collection') {
    return "collection" + node.id;
  } else {
    return "unknown";
  }
}

// Extracts prefixes from the RDF store
function extractPrefixesFromStore(store) {
    let namespaces = {};
    store.namespaces && Object.entries(store.namespaces).forEach(([prefix, uri]) => {
      namespaces[prefix] = uri;
    });
  
    return { ...knownPrefixes, ...namespaces };
  }
  
// Shorten URI – if base defined, use "base:".
function shortenURI(uri, prefixMapping) {
    if (prefixMapping["base"] && uri.indexOf(prefixMapping["base"]) === 0) {
      return "base:" + uri.substring(prefixMapping["base"].length);
    }
    // Filter out any undefined or non-string values.
    var entries = Object.entries(prefixMapping)
      .filter(function ([p, ns]) {
        return ns && typeof ns === "string";
      })
      .map(function ([p, ns]) {
        return { prefix: (p === "" ? "base" : p), ns: ns };
      });
    entries.sort(function (a, b) {
      return b.ns.length - a.ns.length;
    });
    for (var i = 0; i < entries.length; i++) {
      var prefix = entries[i].prefix;
      var ns = entries[i].ns;
      if (uri.indexOf(ns) === 0) {
        return prefix + ":" + uri.substring(ns.length);
      }
    }
    var idx = Math.max(uri.lastIndexOf("/"), uri.lastIndexOf("#"));
    if (idx === -1) return uri;
    var ns = uri.substring(0, idx + 1);
    var local = uri.substring(idx + 1);
    for (var key in prefixMapping) {
      if (prefixMapping[key] === ns) {
        var pfx = (key === "" ? "base" : key);
        return pfx + ":" + local;
      }
    }
    var newPrefix = "ns" + generatedPrefixCounter++;
    prefixMapping[newPrefix] = ns;
    return newPrefix + ":" + local;
  }
        
  function shortenLabel(label,prefixMapping) {
    if (typeof label !== 'string') {
      if (label && typeof label.value === 'string') {
        label = label.value;
      } else {
        console.error('Label is not a string:', label);
        return '[Invalid label]';
      }
    }
    if (label.startsWith("http://") || label.startsWith("https://")) {
      const shortened = shortenURI(label,prefixMapping);
      // Check if the shortened version ends with a colon
      if (shortened.endsWith(':')) {
        return label; // Return the original label
      }
      return shortened; // Return the shortened version
    }
    return label;
  }

function NodeTitle(title, subtitle) {
  return "<b>" + title + "</b>" + (subtitle ? "\n" + subtitle : "");
}

function buildGraphFromStore(store, prefixMapping) {
  var nodesMap = {};
  var edges = [];
  var edgeIdCounter = 0;
  store.statements.forEach(function(st) {
    const subjId = getNodeId(st.subject);
    const pred = st.predicate.value;
    const objId = st.object.termType === 'Literal' ? null : getNodeId(st.object);
    // Handle rdfs:label
    if (pred === 'http://www.w3.org/2000/01/rdf-schema#label') {
      const label=NodeTitle(shortenLabel(subjId,prefixMapping), st.object.value);
      if (!nodesMap[subjId]) {
        nodesMap[subjId] = {
          id: subjId,
          label: label + ' [-]',
          shape: 'box',
          expanded: true,
          baseLabel: label
        };
      } else {
        nodesMap[subjId].label = label + ' [-]';
      }
      return;
    }
    // Handle rdf:type
    if (pred === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
      if (!nodesMap[subjId]) {
        const label=NodeTitle(shortenLabel(subjId,prefixMapping));
        nodesMap[subjId] = {
          id: subjId,
          label: label + ' [-]',
          shape: 'box',
          type: shortenURI(st.object.value,prefixMapping),
          expanded: true,
          baseLabel: label
        };
      } else {
        nodesMap[subjId].type = shortenURI(st.object.value,prefixMapping);
      }
      return;
    }
    // Ensure subject node exists.
    if (!nodesMap[subjId]) {
      const label=NodeTitle(shortenLabel(subjId,prefixMapping));
      nodesMap[subjId] = {
        id: subjId,
        label: label + ' [-]',
        shape: 'box',
        expanded: true,
        baseLabel: label
      };
    }
    // Process object.
    let objNodeId;
    if (st.object.termType === 'Literal') {
      objNodeId = subjId + '-' + pred + '-literal-' + edgeIdCounter;
      nodesMap[objNodeId] = {
        id: objNodeId,
        label: st.object.value,
        shape: 'box',
        baseLabel: st.object.value
      };
    } else {
      objNodeId = objId;
      if (!nodesMap[objNodeId]) {
        const label=NodeTitle(shortenLabel(objNodeId,prefixMapping));
        nodesMap[objNodeId] = {
          id: objNodeId,
          label: label + ' [-]',
          shape: 'box',
          expanded: true,
          baseLabel: label
        };
      }
    }
    edges.push({
      id: 'edge-' + edgeIdCounter++,
      from: subjId,
      to: objNodeId,
      label: shortenLabel(pred,prefixMapping),
      baseLabel: shortenLabel(pred,prefixMapping),
      arrows: { to: { enabled: true, type: 'arrow' } }
    });
  });
  return { nodes: Object.values(nodesMap), edges: edges };
}

function assignColorsToNodes(nodes,prefixMapping) {
  // Hardcode a palette similar to d3.schemeSet2
  var colorIndex = 0;
  // Build mapping for each known prefix.
  let valueColorMap = {};
  for (var prefix in prefixMapping) {
    valueColorMap[prefix]= { uri: prefixMapping[prefix], color: COLOR_PALETTE[colorIndex % COLOR_PALETTE.length]};
    colorIndex++;
  }
  
  
  nodes.forEach(function(node) {
    if (node.type && typeof node.type === 'string') {
      // Assume the type is in the form "prefix:localName"
      var parts = node.type.split(":");
      var prefixCandidate = parts[0];
      if (valueColorMap[prefixCandidate]) {
        node.color = { background: valueColorMap[prefixCandidate].color, border: "#000" };
      } else {
        //valueColorMap[prefixCandidate] = { uri: prefixMapping[prefixCandidate], color: assignedColor};
        node.color = { background: "#CCCCCC", border: "#000" };
      }
    } else {
      node.color = { background: "#CCCCCC", border: "#000" };
    }
    // Construct a simple tooltip (title) by including properties except for some keys.
    var excludeKeys = ['shape', 'color', 'label', 'font'];
    var tooltipContent = "";
    for (var key in node) {
      if (excludeKeys.indexOf(key) < 0) {
        tooltipContent += key + ": " + node[key] + "\n";
      }
    }
    node.title = tooltipContent;
  });
  return valueColorMap;
}

self.onmessage = function(e) {
  var data = e.data;
  if (data.action === "parse") {
    parseRDFInWorker(data.rdfData, data.baseUrl, data.contentType)
      .then(function(graphData) {
        self.postMessage({ status: "success", graphData: graphData });
      })
      .catch(function(error) {
        console.log(error)
        self.postMessage({ status: "error", error: error });
      });
  }
};
