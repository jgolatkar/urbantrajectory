//Init Map
//*******************************************************************************************************************************************************
var lat = 41.141376;
var lng = -8.613999;
var zoom = 14;

// add an OpenStreetMap tile layer
var mbAttr = 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
    '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
    'Imagery © <a href="http://mapbox.com">Mapbox</a>',
    mbUrl = 'https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoicGxhbmVtYWQiLCJhIjoiemdYSVVLRSJ9.g3lbg_eN0kztmsfIPxa9MQ';


var grayscale = L.tileLayer(mbUrl, {
        id: 'mapbox.light',
        attribution: mbAttr
    }),
    streets = L.tileLayer(mbUrl, {
        id: 'mapbox.streets',
        attribution: mbAttr
    });


var map = L.map('map', {
    center: [lat, lng], // Porto
    zoom: zoom,
    layers: [streets],
    zoomControl: true,
    fullscreenControl: true,
    fullscreenControlOptions: { // optional
        title: "Show me the fullscreen !",
        titleCancel: "Exit fullscreen mode",
        position: 'bottomright'
    }
});

var baseLayers = {
    "Grayscale": grayscale, // Grayscale tile layer
    "Streets": streets, // Streets tile layer
};

layerControl = L.control.layers(baseLayers, null, {
    position: 'bottomleft'
}).addTo(map);

// Initialise the FeatureGroup to store editable layers
var drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

var featureGroup = L.featureGroup();

var drawControl = new L.Control.Draw({
    position: 'bottomright',
	collapsed: false,
    draw: {
        // Available Shapes in Draw box. To disable anyone of them just convert true to false
        polyline: false,
        polygon: false,
        circle: false,
        rectangle: true,
        marker: false,
    }

});
map.addControl(drawControl); // To add anything to map, add it to "drawControl"
//*******************************************************************************************************************************************************
//*****************************************************************************************************************************************
// Index Road Network by Using R-Tree
//*****************************************************************************************************************************************
var rt = cw(function(data,cb){
	var self = this;
	var request,_resp;
	importScripts("js/rtree.js");
	if(!self.rt){
		self.rt=RTree();
		request = new XMLHttpRequest();
		request.open("GET", data);
		request.onreadystatechange = function() {
			if (request.readyState === 4 && request.status === 200) {
				_resp=JSON.parse(request.responseText);
				self.rt.geoJSON(_resp);
				cb(true);
			}
		};
		request.send();
	}else{
		return self.rt.bbox(data);
	}
});

rt.data(cw.makeUrl("js/trips.json"));
//*****************************************************************************************************************************************	
//*****************************************************************************************************************************************
// Drawing Shapes (polyline, polygon, circle, rectangle, marker) Event:
// Select from draw box and start drawing on map.
//*****************************************************************************************************************************************	

map.on('draw:created', function (e) {
	
	var type = e.layerType,
		layer = e.layer;
	
	if (type === 'rectangle') {
		//console.log(layer.getLatLngs()); //Rectangle Corners points
		var bounds=layer.getBounds();
		rt.data([[bounds.getSouthWest().lng,bounds.getSouthWest().lat],[bounds.getNorthEast().lng,bounds.getNorthEast().lat]]).
		then(function(d){var result = d.map(function(a) {return a.properties;});
		//console.log(result);		// Trip Info: avspeed, distance, duration, endtime, maxspeed, minspeed, starttime, streetnames, taxiid, tripid
		DrawRS(result);
		generateWordCloudMap(result);
		//chordDraw(result);
		plotScatter(result);
		});
	}
	
	drawnItems.addLayer(layer);			//Add your Selection to Map  
});
//*****************************************************************************************************************************************
// DrawRS Function:
// Input is a list of road segments ID and their color. Then the visualization can show the corresponding road segments with the color
// Test:      var input_data = [{road:53, color:"#f00"}, {road:248, color:"#0f0"}, {road:1281, color:"#00f"}];
//            DrawRS(input_data);
//*****************************************************************************************************************************************
function DrawRS(trips) {
	for (var j=0; j<trips.length; j++) {  // Check Number of Segments and go through all segments
		var TPT = new Array();			  
		TPT = TArr[trips[j].tripid].split(',');  		 // Find each segment in TArr Dictionary. 
		var polyline = new L.Polyline([]).addTo(drawnItems);
        polyline.setStyle({
            color: 'red',                      // polyline color
			weight: 1,                         // polyline weight
			opacity: 0.5,                      // polyline opacity
			smoothFactor: 1.0  
        });
		for(var y = 0; y < TPT.length-1; y=y+2){    // Parse latlng for each segment
			polyline.addLatLng([parseFloat(TPT[y+1]), parseFloat(TPT[y])]);
		}
	}		
}

//create word cloud @jgolatkar

function generateWordCloudMap(streetdata){
	var wordsMap = {};
	streetdata.forEach(element => {
		element['streetnames'].forEach(street => {
				if (wordsMap.hasOwnProperty(street)) {
				wordsMap[street]++;
				} else {
				wordsMap[street] = 1;
				}
		});
	});
	//console.log(wordsMap);
	generateNodeData(wordsMap);
	
}

function generateNodeData(frequencies) {
	// convert map to array
	var freqArr = [];
	//var it = frequencies.iterator;

	Object.keys(frequencies).forEach(function(key) {
		freqArr.push({ text: key, size: frequencies[key]});
	});

	//console.log(freqArr);
	freqArr.sort(function(a, b){
		return b.size - a.size;
	});
	
	cloudDraw(freqArr);
	
}

function cloudDraw(words){
	d3.wordcloud()
					.size([450, 600])
					.fill(d3.scale.ordinal().range(["#884400", "#448800", "#888800", "#444400", "#464300"]))
					.words(words)
					.onwordclick(function(d, i) {
						if (d.href) { window.location = d.href; }
					})
					.start();
	//d3.wordcloud.stop();
}

// function to draw chord plot

var trips = [];
function chordDraw(result){
	let unique = new Set();
	result.forEach(t => {
		let from = t['streetnames'][0];
		let to = t['streetnames'][t['streetnames'].length - 1];
		let dist = t['distance'];
		// add only unique paths to avoid cycles in data
		unique.add(from);
		if(!unique.has(to)){
			trips.push([from,to,dist]);
		}
	});
	//console.log('unique:',trips);
	google.charts.load('current', {'packages':['sankey']});
    google.charts.setOnLoadCallback(drawChart);
}

function drawChart(){
	
	var data = new google.visualization.DataTable();
	data.addColumn('string', 'From');
	data.addColumn('string', 'To');
	data.addColumn('number', 'Distance');
	data.addRows(trips);
	var colors = ['#a6cee3', '#b2df8a', '#fb9a99', '#fdbf6f',
                  '#cab2d6', '#ffff99', '#1f78b4', '#33a02c'];

    var options = {
	  width:450,
      height: 800,
      sankey: {
        node: {
		  colors: colors, // Allows you to select nodes.
		  nodePadding: 30     // Vertical distance between nodes.    
        },
        link: {
          colorMode: 'gradient',
          colors: colors
        }
      }
    };
	var chart = new google.visualization.Sankey(document.getElementById('sankey'));
	chart.draw(data, options);
	trips = []; // reset trip array;
}


function plotScatter(trips){
	console.log('in plot scatter');
    //size 
    var size = 150,
        padding = 20;
    //color scale
    var color = d3.scale.ordinal().range([
        "rgb(50%, 0%, 0%)",
        "rgb(0%, 50%, 0%)",
        "rgb(0%, 0%, 50%)"
    ]);
    //create scatter data array
    var traits = [];
   trips.forEach(t => {
		let avgspeed = t['avspeed'];
		let dist = t['distance'];
		let dur = t['duration'];
		traits.push({avspeed:avgspeed,distance:dist,duration:dur});
	});
	
	var position = {};

	   	Object.keys(traits[0]).forEach(function(trait) {
	     function value(d) { return d[trait]; }
	     position[trait] = d3.scale.linear()
	         .domain([d3.min(traits, value), d3.max(traits, value)])
			 .range([padding / 2, size - padding / 2]);
	   });

	console.log(Object.keys(traits[0])); 
	//console.log('position:',position);   

	var svg = d3.select("#scatter-plot")
	     .append("svg:svg")
	       .attr("width", size * Object.keys(traits[0]).length)
		   .attr("height", size * Object.keys(traits[0]).length);
		
	//console.log('key lengths:', Object.keys(traits[0]).length);
	//console.log('traits:', traits[0]);
	
	var column = svg.selectAll("g")
      .data(Object.keys(traits[0]))
      .enter().append("svg:g")
      .attr("transform", function(d, i) { return "translate(" + i * size + ",0)"; })

// One row per trait.
   var row = column.selectAll("g")
       	.data(cross(Object.keys(traits[0])))
		.enter().append("svg:g")
	    .attr("transform", function(d, i) { return "translate(0," + i * size + ")"; });

		row.selectAll("line.x")
		       .data(function(d) { return position[d.x].ticks(5).map(position[d.x]); })
		     .enter().append("svg:line")
		       .attr("class", "x")
		       .attr("x1", function(d) { return d; })
		       .attr("x2", function(d) { return d; })
		       .attr("y1", padding / 2)
		       .attr("y2", size - padding / 2);
// Y-ticks. 
   row.selectAll("line.y")
       .data(function(d) { return position[d.y].ticks(5).map(position[d.y]); })
     .enter().append("svg:line")
       .attr("class", "y")
       .attr("x1", padding / 2)
       .attr("x2", size - padding / 2)
       .attr("y1", function(d) { return d; })
	   .attr("y2", function(d) { return d; });
	   


// Frame.
   row.append("svg:rect")
       .attr("x", padding / 2)
       .attr("y", padding / 2)
       .attr("width", size - padding)
       .attr("height", size - padding)
       .style("fill", "none")
       .style("stroke", "#aaa")
       .style("stroke-width", 1.5)
       .attr("pointer-events", "all")
       .on("mousedown", mousedown);

// Dot plot.
  var dot = row.selectAll("circle")
       .data(cross(traits))
     .enter().append("svg:circle")
       .attr("cx", function(d) { return position[d.x.x](d.y[d.x.x]); })
       .attr("cy", function(d) { return size - position[d.x.y](d.y[d.x.y]); })
       .attr("r", 3)
       .style("fill", function(d) { return color(d.y.duration); })
       .style("fill-opacity", .5)
       .attr("pointer-events", "none");

	   d3.select(window)
	          .on("mousemove", mousemove)
	          .on("mouseup", mouseup);
	    
	      var rect, x0, x1, count;
	    
	      function mousedown() {
			x0 = d3.mouse(this);
	        count = 0;
	    
	        rect = d3.select(this.parentNode)
	          .append("svg:rect")
	            .style("fill", "#999")
	            .style("fill-opacity", .5);
	    
	        d3.event.preventDefault();
		 }
		 
		 function mousemove() {
			     if (!rect) return;
			     x1 = d3.mouse(rect.node());
			 
			     x1[0] = Math.max(padding / 2, Math.min(size - padding / 2, x1[0]));
			     x1[1] = Math.max(padding / 2, Math.min(size - padding / 2, x1[1]));
			 
			     var minx = Math.min(x0[0], x1[0]),
			         maxx = Math.max(x0[0], x1[0]),
			         miny = Math.min(x0[1], x1[1]),
			         maxy = Math.max(x0[1], x1[1]);
			 
			     rect
			         .attr("x", minx - .5)
			         .attr("y", miny - .5)
			         .attr("width", maxx - minx + 1)
			         .attr("height", maxy - miny + 1);
			var v = rect.node().__data__,
			         x = position[v.x],
			         y = position[v.y],
			         mins = x.invert(minx),
			         maxs = x.invert(maxx),
			         mint = y.invert(size - maxy),
			         maxt = y.invert(size - miny);
					 count = 0;
					      svg.selectAll("circle")
					          .style("fill", function(d) {
					            return mins <= d.y[v.x] && maxs >= d.y[v.x]
					                && mint <= d.y[v.y] && maxt >= d.y[v.y]
					                ? (count++, color(d.y.duration))
					                : "#ccc";
					          });
	   }
	   function mouseup() {
		     if (!rect) return;
		     rect.remove();
		     rect = null; 
		     if (!count) svg.selectAll("circle")
		         .style("fill", function(d) {
		           return color(d.y.duration);
		         });
		   }

}

function cross(a) {
	   return function(d) {
	     var c = [];
	     for (var i = 0, n = a.length; i < n; i++) c.push({x: d, y: a[i]});
	     return c;
	   };
 }





