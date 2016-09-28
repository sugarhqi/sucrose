sucrose.models.line = function() {

  //============================================================
  // Public Variables with Default Settings
  //------------------------------------------------------------

  var scatter = sucrose.models.scatter();

  var margin = {top: 0, right: 0, bottom: 0, left: 0},
      width = 960,
      height = 500,
      getX = function(d) { return d.x; }, // accessor to get the x value from a data point
      getY = function(d) { return d.y; }, // accessor to get the y value from a data point
      defined = function(d, i) { return !isNaN(getY(d, i)) && getY(d, i) !== null; }, // allows a line to be not continuous when it is not defined
      isArea = function(d) { return (d && d.area) || false; }, // decides if a line is an area or just a line
      interpolate = 'linear', // controls the line interpolation
      x, //can be accessed via chart.xScale()
      y, //can be accessed via chart.yScale()
      clipEdge = false, // if true, masks lines within x and y scale
      delay = 0, // transition
      duration = 300, // transition
      color = function(d, i) { return sucrose.utils.defaultColor()(d, d.series); },
      fill = color,
      classes = function(d, i) { return 'sc-group sc-series-' + d.series; };


  //============================================================
  // Private Variables
  //------------------------------------------------------------

  // var x0, y0; //used to store previous scales

  //============================================================

  function chart(selection) {
    selection.each(function(data) {
      var availableWidth = width - margin.left - margin.right,
          availableHeight = height - margin.top - margin.bottom,
          container = d3.select(this);

      var curve =
            interpolate === 'linear' ? d3.curveLinear :
            interpolate === 'cardinal' ? d3.curveCardinal :
            interpolate === 'monotone' ? d3.curveMonotoneX :
            interpolate === 'basis' ? d3.curveBasis : d3.natural;

      var t = d3.transition('scatter')
          .duration(duration)
          .ease(d3.easeLinear);

      //set up the gradient constructor function
      chart.gradient = function(d, i, p) {
        return sucrose.utils.colorLinearGradient(d, chart.id() + '-' + i, p, color(d, i), wrap.select('defs'));
      };

      //------------------------------------------------------------
      // Setup Scales

      x = scatter.xScale();
      y = scatter.yScale();
      // x0 = x.copy();
      // y0 = y.copy();

      //------------------------------------------------------------
      // Setup containers and skeleton of chart

      var wrap_bind = container.selectAll('g.sc-wrap.sc-line').data([data]);
      var wrap_entr = wrap_bind.enter().append('g').attr('class', 'sucrose sc-wrap sc-line');
      var wrap = container.select('.sucrose.sc-wrap').merge(wrap_entr);
      var defs_entr = wrap_entr.append('defs');
      var g_entr = wrap_entr.append('g').attr('class', 'sc-chart-wrap');
      var g = container.select('g.sc-chart-wrap').merge(g_entr);

      g_entr.append('g').attr('class', 'sc-groups');
      var groups_wrap = wrap.select('.sc-groups');
      g_entr.append('g').attr('class', 'sc-scatter-wrap');
      var scatter_wrap = wrap.select('.sc-scatter-wrap');

      wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

      //------------------------------------------------------------

      scatter
        .width(availableWidth)
        .height(availableHeight);
      scatter_wrap.call(scatter);

      defs_entr.append('clipPath')
        .attr('id', 'sc-edge-clip-' + scatter.id())
          .append('rect');

      wrap.select('#sc-edge-clip-' + scatter.id() + ' rect')
          .attr('width', availableWidth)
          .attr('height', availableHeight);

      g.attr('clip-path', clipEdge ? 'url(#sc-edge-clip-' + scatter.id() + ')' : '');
      scatter_wrap.attr('clip-path', clipEdge ? 'url(#sc-edge-clip-' + scatter.id() + ')' : '');

      //------------------------------------------------------------
      // Groups

      var groups_bind = groups_wrap.selectAll('g.sc-group')
            .data(function(d) { return d; }, function(d) { return d.series; });
      var groups_entr = groups_bind.enter().append('g')
            .attr('class', 'sc-group')
            .style('stroke-opacity', 1e-6)
            .style('fill-opacity', 1e-6);
      var groups = wrap.select('.sc-groups').selectAll('.sc-group')
            .merge(groups_entr);

      groups
        .classed('hover', function(d) { return d.hover; })
        .attr('class', classes)
        .attr('fill', color)
        .attr('stroke', color);
      groups
        .transition(t)
          .style('stroke-opacity', 1)
          .style('fill-opacity', 0.5);
      groups_bind.exit()
        .transition(t)
          .style('stroke-opacity', 1e-6)
          .style('fill-opacity', 1e-6)
          .remove();

      //------------------------------------------------------------
      // Areas

      var areas_bind = groups.selectAll('path.sc-area').data(function(d) { return isArea(d) ? [d] : []; }); // this is done differently than lines because I need to check if series is an area
      var areas_entr = areas_bind.enter().append('path').attr('class', 'sc-area sc-enter');
      var areas = groups.selectAll('.sc-area').merge(areas_entr);

      areas
        .filter(function(d) {
          return d3.select(this).classed('sc-enter');
        })
        .attr('d', function(d) {
          return d3.area()
              .curve(curve)
              .defined(defined)
              .x(function(d, i) { return x(getX(d, i)); })
              .y0(function(d, i) { return y(0); })
              .y1(function(d, i) { return y(y.domain()[0] <= 0 ? y.domain()[1] >= 0 ? 0 : y.domain()[1] : y.domain()[0]); })
              .apply(this, [d.values]);
        });
      areas
        .transition(t)
          .attr('d', function(d) {
            return d3.area()
                .curve(curve)
                .defined(defined)
                .x(function(d, i) { return x(getX(d, i)); })
                .y0(function(d, i) { return y(getY(d, i)); })
                .y1(function(d, i) { return y(y.domain()[0] <= 0 ? y.domain()[1] >= 0 ? 0 : y.domain()[1] : y.domain()[0]); })
                .apply(this, [d.values]);
          })
          .on('end', function(d) {
            d3.select(this).classed('sc-enter', false);
          });
      // we need this exit remove call here to support
      // toggle between lines and areas
      areas_bind.exit().remove();

      groups_bind.exit()
        .transition(t).selectAll('.sc-area')
          .attr('d', function(d) {
            return d3.area()
                .curve(curve)
                .defined(defined)
                .x(function(d, i) { return x(getX(d, i)); })
                .y0(function(d, i) { return y(0); })
                .y1(function(d, i) { return y(y.domain()[0] <= 0 ? y.domain()[1] >= 0 ? 0 : y.domain()[1] : y.domain()[0]); })
                //.y1(function(d,i) { return y0(0) }) //assuming 0 is within y domain.. may need to tweak this
                .apply(this, [d.values]);
          })
          .remove();

      //------------------------------------------------------------
      // Lines
      function lineData(d) {
        // if there are no values, return null
        if (!d.values || !d.values.length) {
          return [null];
        }
        // if there is more than one point, return all values
        if (d.values.length > 1) {
          return [d.values];
        }
        // if there is only one single point in data array
        // extend it horizontally in both directions
        var values = x.domain().map(function(x, i) {
            // if data point is array, then it should be returned as an array
            // the getX and getY methods handle the internal mechanics of positioning
            if (Array.isArray(d.values[0])) {
              return [x, d.values[0][1]];
            } else {
              // sometimes the line data point is an object
              // so the values should be returned as an array of objects
              var newValue = JSON.parse(JSON.stringify(d.values[0]));
              newValue.x = x;
              return newValue;
            }
          });
        return [values];
      }

      var lines_bind = groups.selectAll('path.sc-line')
            .data(lineData, function(d) { return d.series; });
      var lines_entr = lines_bind.enter().append('path')
            .attr('class', 'sc-line sc-enter');
      var lines = groups.selectAll('.sc-line')
            .merge(lines_entr);

      lines
        .filter(function(d) {
          return d3.select(this).classed('sc-enter');
        })
        .attr('d',
          d3.line()
            .curve(curve)
            .defined(defined)
            .x(function(d, i) { return x(getX(d, i)); })
            .y(function(d, i) { return y(0); })
        );
      lines
        .transition(t)
          .attr('d',
            d3.line()
              .curve(curve)
              .defined(defined)
              .x(function(d, i) { return x(getX(d, i)); })
              .y(function(d, i) { return y(getY(d, i)); })
          )
          .on('end', function(d) {
            d3.select(this).classed('sc-enter', false);
          });
      groups_bind.exit()
        .transition(t).selectAll('.sc-line')
          .attr('d',
            d3.line()
              .curve(curve)
              .defined(defined)
              .x(function(d, i) { return x(getX(d, i)); })
              .y(function(d, i) { return y(0); })
          )
          .remove();

      //store old scales for use in transitions on update
      // x0 = x.copy();
      // y0 = y.copy();
    });

    return chart;
  }


  //============================================================
  // Expose Public Variables
  //------------------------------------------------------------

  chart.dispatch = scatter.dispatch;
  chart.scatter = scatter;

  fc.rebind(chart, scatter, 'id', 'interactive', 'size', 'xScale', 'yScale', 'zScale', 'xDomain', 'yDomain', 'sizeDomain', 'sizeRange', 'forceX', 'forceY', 'forceSize', 'useVoronoi', 'clipVoronoi', 'clipRadius', 'padData', 'padDataOuter', 'singlePoint', 'nice', 'locality');

  chart.color = function(_) {
    if (!arguments.length) { return color; }
    color = _;
    scatter.color(color);
    return chart;
  };
  chart.fill = function(_) {
    if (!arguments.length) { return fill; }
    fill = _;
    scatter.fill(fill);
    return chart;
  };
  chart.classes = function(_) {
    if (!arguments.length) { return classes; }
    classes = _;
    scatter.classes(classes);
    return chart;
  };
  chart.gradient = function(_) {
    if (!arguments.length) { return gradient; }
    gradient = _;
    return chart;
  };

  chart.margin = function(_) {
    if (!arguments.length) { return margin; }
    margin.top    = typeof _.top    != 'undefined' ? _.top    : margin.top;
    margin.right  = typeof _.right  != 'undefined' ? _.right  : margin.right;
    margin.bottom = typeof _.bottom != 'undefined' ? _.bottom : margin.bottom;
    margin.left   = typeof _.left   != 'undefined' ? _.left   : margin.left;
    return chart;
  };

  chart.width = function(_) {
    if (!arguments.length) { return width; }
    width = _;
    return chart;
  };

  chart.height = function(_) {
    if (!arguments.length) { return height; }
    height = _;
    return chart;
  };

  chart.x = function(_) {
    if (!arguments.length) { return getX; }
    getX = _;
    scatter.x(_);
    return chart;
  };

  chart.y = function(_) {
    if (!arguments.length) { return getY; }
    getY = _;
    scatter.y(_);
    return chart;
  };

  chart.delay = function(_) {
    if (!arguments.length) {
      return delay;
    }
    delay = _;
    return chart;
  };

  chart.duration = function(_) {
    if (!arguments.length) {
      return duration;
    }
    duration = _;
    scatter.duration(_);
    return chart;
  };

  chart.clipEdge = function(_) {
    if (!arguments.length) { return clipEdge; }
    clipEdge = _;
    return chart;
  };

  chart.interpolate = function(_) {
    if (!arguments.length) { return interpolate; }
    interpolate = _;
    return chart;
  };

  chart.defined = function(_) {
    if (!arguments.length) { return defined; }
    defined = _;
    return chart;
  };

  chart.isArea = function(_) {
    if (!arguments.length) { return isArea; }
    isArea = sucrose.functor(_);
    return chart;
  };

  //============================================================

  return chart;
};