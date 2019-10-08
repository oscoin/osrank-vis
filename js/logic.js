function settingsMonitor(layout, inputsCollection, renderer) {
    var fields = {},
        fieldIds = [],
        i,
        defaults = {},

        valueChanged = function() {
            var newValue = parseFloat(this.value);
            var simulator = layout.simulator;
            if (!isNaN(newValue)) {
                simulator[this.id](newValue);
                renderer.resume();
            }
        };

    var simulator = layout.simulator;
    for(i = 0; i < inputsCollection.length; ++i) {
        if (simulator.hasOwnProperty(inputsCollection[i].id)) {
            var id = inputsCollection[i].id;
            fieldIds.push(id);
            fields[id] = $(inputsCollection[i]);
        } else {
            console.log('Unknown layout parameter: ' + inputsCollection[i].id);
        }
    }

    for(i = 0; i < fieldIds.length; ++i) {
        var name =fieldIds[i],
            defaultValue = simulator[name]();
        defaults[name] = defaultValue;
        fields[name].val(defaultValue).change(valueChanged);
    }

    return {
        updateToDefault : function() {
            var simulator = layout.simulator;
            for(var k in defaults) {
                if (defaults.hasOwnProperty(k)) {
                    fields[k].val(defaults[k]);
                    simulator[k](defaults[k]);
                }
            }
            renderer.resume();
        }
    };
}

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

    var graph = NgraphGexf.load(Graphs.Cargo),
        descriptionContainer = $('#description'),
        isPaused = false,
        cache = simpleCache();

    window.TheGraph = graph;

    var layout = Viva.Graph.Layout.forceDirected(graph, {
        springLength : 30,
        springCoeff : 0.0008,
        dragCoeff : 0.009,
        gravity : -1.2,
        theta : 0.8
    });

    var graphics = webglSupported ? Viva.Graph.View.webglGraphics() : Viva.Graph.View.svgGraphics();
    graphics
        .node(function(node){
            var r = node.data.viz.color.r;
            var g = node.data.viz.color.g;
            var b = node.data.viz.color.b;
            var col_hex = ((1 << 24) + (0 << 16) + (0 << 8) + 255).toString(16).slice(1)
            return Viva.Graph.View.webglSquare(node.data.viz.size, "#" + col_hex);
        })
        .link(function(link) {
            return Viva.Graph.View.webglLine("#000000");
        });

    var renderer = Viva.Graph.View.renderer(graph,
        {
            layout     : layout,
            graphics   : graphics,
            renderLinks : true,
            container : document.getElementById('graphVisualization')
        });

    renderer.run();

    var renderGraph = function(edges, recordsPerEdge) {
        graph.beginUpdate();
        for(var i = 0; i < edges.length - 1; i += recordsPerEdge) {
            graph.addLink(edges[i], edges[i + 1]);
        }

        graph.endUpdate();
    },

        setDescription = function(description) {
            if (graph.name) {
                var thumbnail = 'http://yifanhu.net//GALLERY/GRAPHS/GIF_THUMBNAIL/',
                    full = 'http://yifanhu.net/GALLERY/GRAPHS/GIF_SMALL/',
                    parts = graph.name.split('/'),
                    imgName = parts[0] + '@' + parts[1] + '.gif';
                descriptionContainer.append('<h3>' + graph.name + '</h3>');
                descriptionContainer.append('<div><b>Nodes: </b>' + graph.getNodesCount() + '</div>');
                descriptionContainer.append('<div><b>Edges: </b>' + graph.getLinksCount() + '</div>');
                descriptionContainer.append('<div><b>Image: </b><br/><img src="' + thumbnail + imgName + '" /></div>');
                $('img', descriptionContainer).popover({content : '<img src="' + full + imgName + '" />', placement : 'left'});

                descriptionContainer.show();
            }
        },

        graphUpdated = function(mtxObject) {
            $('#progress').hide();
            // unpack graph mtxObject to normal array.
            //renderGraph(mtxObject.links, mtxObject.recordsPerEdge);
            setDescription("Cargo");
            $('#toggleLayout').html('<i class="icon-pause"></i>Pause layout');
        },

        loadGraph = function(search) {
            $('#progress').show();
            descriptionContainer.empty().hide();

            //graph.clear();

            graphUpdated(graph);

            //var cachedGraph = cache.get(search);
            //if (cachedGraph) {
            //    graphUpdated(cachedGraph);
            //} else {
            //    var url = 'http://s3.amazonaws.com/yasiv_uf/out/' + search + '/index.js';

            //    $.ajax({
            //        url: url,
            //        dataType: 'json',
            //        success: function(data) {
            //            cache.put(search, data);
            //            graphUpdated(data);
            //        }
            //    });
            //}
            return false;
        },

        getCurrentGraphName = function() {
            var query = window.location.hash,
                graphMatch = query.match(/\#(.+\/.+)/i);
            return graphMatch ? graphMatch[1] : null;
        },

        toggleLayout = function() {
            isPaused = !isPaused;
            if (isPaused) {
                $('#toggleLayout').html('<i class="icon-play"></i>Resume layout');
                renderer.pause();
            } else {
                $('#toggleLayout').html('<i class="icon-pause"></i>Pause layout');
                renderer.resume();
            }
            return false;
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
    $(window).keydown(function(e) {
        if (e.keyCode === 32) { // toggle on spacebar;
            toggleLayout();
        }
    });

    $('#toggleLayout').click(function() {
        toggleLayout();
    });
    var settings = $('#settings');
    $('i', settings).tooltip({placement : 'left'});
    var monitor = settingsMonitor(layout, $('input', settings), renderer);
    $('.btn', settings).click(function(){ monitor.updateToDefault(); });
    visualizeCurrentHash();

    r = renderer;
    l = layout;
    g = graph;
}

$(run);
