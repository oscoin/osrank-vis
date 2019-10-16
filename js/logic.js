
(function($) {
$.fn.donetyping = function(callback){
    var _this = $(this);
    var x_timer;    
    _this.keyup(function (){
        clearTimeout(x_timer);
        x_timer = setTimeout(clear_timer, 500);
    }); 

    function clear_timer(){
        clearTimeout(x_timer);
        callback.call(_this);
    }
}
})(jQuery);

var InDegree  = {};
var OutDegree = {};

function simpleCache() {
    var supported = window.hasOwnProperty('localStorage');

    return {
        get : function(key) {
            if (!supported) { return null; }
            var graphData = JSON.parse(window.localStorage.getItem(key));
            if (!graphData || graphData.recordsPerEdge === undefined) {
                // this is old cache. Invalidate it
                return null;
            }
            return graphData;
        },
        put : function(key, value) {
            if (!supported) { return false;}
            try {
                window.localStorage.setItem(key, JSON.stringify(value));
            } catch(err) {
                // TODO: make something clever than this in case of quata exceeded.
                window.localStorage.clear();
            }
        }
    };
}

function runNodeExplorer(graph, graphics, renderer) {
    var lastNodeColor;
    var lastNodeId;
    var lastNodeSize;
    var lastIncomingLinks = [];
    var lastDependecies = [];

    var updateResults = function () {
        var result;
        var ul = $("#node-explorer-result");
        var nodeId = $("#node-explorer").val();

        if (graph !== undefined) {
          result = graph.getNode(nodeId);
          ul.empty();
            if (result !== undefined) {
                ul.append('<li><a href="#">Name:</a> ' + nodeId + '</li>');
                ul.append('<li><a href="#">Rank:</a> ' + result.data.osrank + '</li>');
                ul.append('<li><a href="#">In-Degree:</a> '  + InDegree[nodeId]  + '</li>');
                ul.append('<li><a href="#">Out-Degree:</a> ' + OutDegree[nodeId] + '</li>');
            }
        }

        return nodeId;
    };

    var unHighlightLast = function (nodeId) {
        // Restore the properties of the previously-selected node, if any.
        if (lastNodeId !== undefined) {
            graphics.getNodeUI(lastNodeId).color = lastNodeColor;
            graphics.getNodeUI(lastNodeId).size  = lastNodeSize;

            lastIncomingLinks.forEach(function (l, index) {
                // Restore the links colour.
                graphics.getLinkUI(l.id).color = 0xF0F0F0ff;
            });

            lastDependecies.forEach(function (dep, index) {
                let ui = graphics.getNodeUI(dep.id);
                ui.color = dep.color;
                ui.size  = dep.size;
            });

            renderer.rerender();
        }
    };

    var highlightNode = function (nodeId) {

        // un-highlight any previous node, if any.
        if (nodeId == "") {
            unHighlightLast();
            return;
        }

        if (nodeId !== undefined) {

            unHighlightLast();

            var ui = graphics.getNodeUI(nodeId);
            if (ui !== undefined) {
                lastNodeId = nodeId;
                lastNodeColor = graphics.getNodeUI(nodeId).color;
                lastNodeSize = graphics.getNodeUI(nodeId).size;
                graphics.getNodeUI(nodeId).color = 0xFFA500ff;
                graphics.getNodeUI(nodeId).size  = 70;
                renderer.rerender();
            }
        }
    };
    
    var highlightOutgoingLinks = function (nodeId) {

        lastDependecies = [];

        if (nodeId !== undefined && nodeId !== "") {

            var node = graph.getNode(nodeId);
            if (node !== undefined) {
                var allLinks = node.links;
                lastIncomingLinks = allLinks;

                allLinks.forEach(function (l, index) {
                    // Highlight packages which depends on this node.
                    if (l.toId == nodeId) {

                        let fromIdNodeUI = graphics.getNodeUI(l.fromId);
                        lastDependecies.push({ id: l.fromId, color: fromIdNodeUI.color, size: fromIdNodeUI.size });

                        graphics.getLinkUI(l.id).color = 0xFFA500ff;

                        // avoid self-loops
                        if (l.fromId != nodeId) {
                            fromIdNodeUI.size = 50;
                            fromIdNodeUI.color = 0x008000ff;
                        }
                    }
                });
            }

            renderer.rerender();
        }
    };

    var updateNodeExplorerResults = function () {
        var selectedNode = updateResults();
        highlightNode(selectedNode);
        highlightOutgoingLinks(selectedNode);
    };

    $("#node-explorer").donetyping(function(callback){
        updateNodeExplorerResults();
    });
}

function run() {

    var buildNavigationUI = function() {
        var container = $('#graphsContainer'),
            groups = {},
            i;

        container.append('<li class="nav-header">Package managers</li>');

        for(i = 0; i < graphsDb.ecosystems.length; ++i) {
            var item = graphsDb.ecosystems[i];
            container.append('<li id="' + item.replace('/', '') + '"><a href="#' + item + '">' + item + '</a>');
        }

        for(var k in groups) {
            if (groups.hasOwnProperty(k)) {
                var subitems = groups[k];
                container.append('<li class="nav-header">' + k + '</li>');
                for(i = 0; i < subitems.length; ++i) {
                    var id = k + '/' + subitems[i];
                    container.append('<li id="' + k + subitems[i] + '"><a href="#' + id  + '">' + subitems[i] + '</a>');
                }
            }
        }
    },

        checkSupport = function() {
            if (window.WebGLRenderingContext) {
                var elem = document.createElement('canvas');

                if (!elem.getContext || !elem.getContext('experimental-webgl')) {
                    $('#webglsupport').show();
                    return false;
                }
                return true;
            }
            return false;
        },

        webglSupported = checkSupport();

    buildNavigationUI();

    var graph = Viva.Graph.graph(),
        descriptionContainer = $('#description'),
        cache = simpleCache();

    window.TheGraph = graph;
    window.TheCache = cache;

    var layout = Viva.Graph.Layout.constant(graph);
    layout.placeNode(function(node) {
        return node.data.viz.position;
    });

    var graphics = webglSupported ? Viva.Graph.View.webglGraphics() : Viva.Graph.View.svgGraphics();
    window.TheGraphics = graphics;
    graphics
        .node(function(node){
            var r = node.data.viz.color.r;
            var g = node.data.viz.color.g;
            var b = node.data.viz.color.b;
            var col_hex = ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
            return Viva.Graph.View.webglSquare(node.data.viz.size, "#" + col_hex);
        })
        .link(function(link) {
            return Viva.Graph.View.webglLine("#F0F0F0");
        });

    var renderer = Viva.Graph.View.renderer(graph,
        {
            layout     : layout,
            graphics   : graphics,
            renderLinks : true,
            container : document.getElementById('graphVisualization')
        });

    runNodeExplorer(graph, graphics, renderer);

    window.TheRendered = renderer;
    renderer.run();

    var renderGraph = function(graphName, newGraph) {
        graph.beginUpdate();
        newGraph.forEachNode(function(n) {
            graph.addNode(n.id, n.data);
        });
        newGraph.forEachLink(function(link) {
            graph.addLink(link.fromId,link.toId,link.data);
        });
        graph.name = graphName;

        InDegree  = Degree.degree(graph, 'in');
        OutDegree = Degree.degree(graph, 'out');

        graph.endUpdate();
    },

        setDescription = function(description) {
            if (graph.name) {
                descriptionContainer.empty();
                descriptionContainer.append('<h3>' + graph.name + '</h3>');
                descriptionContainer.append('<div><b>Nodes: </b>' + graph.getNodesCount() + '</div>');
                descriptionContainer.append('<div><b>Edges: </b>' + graph.getLinksCount() + '</div>');
                descriptionContainer.show();
            }
        },

        graphUpdated = function(graphName, graph) {
            $('#progress').hide();
            renderGraph(graphName, graph);
            setDescription(graphName);
        },

        loadGraph = function(search) {
            console.log("Starting to load the graph..");
            $('#progress').show();
            descriptionContainer.empty().hide();

            graph.clear();
            graphUpdated(search, graph);

            var cachedGraph = cache.get(search);
            if (cachedGraph) {
                console.debug("Cached graph found.");
                console.debug(cachedGraph);
                graphUpdated(search, cachedGraph);
            } else {
                console.debug("Grabbing a new graph");
                var gunzip = new Zlib.Gunzip(Graphs[search]);
                var newGraph = NgraphGexf.load(new TextDecoder("utf-8").decode(gunzip.decompress()));
                console.debug("Finished building and decompressing..");
                graphUpdated(search, newGraph);
                // Cache not working for now.
                // cache.put(search, newGraph);
            }
            return false;
        },

        getCurrentGraphName = function() {
            var query = window.location.hash,
                graphMatch = query.match(/\#(.+)/i);
            return graphMatch ? graphMatch[1] : null;
        },

        visualizeCurrentHash = function() {
            var graphName = getCurrentGraphName();

            graph.name = graphName;
            if (graphName) {
                loadGraph(graphName);
                var currentItem = $('#' + graphName.replace('/', ''));
                $('.active').removeClass('active');
                currentItem.addClass('active');
            }
        };

    $(window).hashchange(visualizeCurrentHash);

    var settings = $('#settings');
    $('i', settings).tooltip({placement : 'left'});
    visualizeCurrentHash();

    r = renderer;
    l = layout;
    g = graph;
}

$(run);
