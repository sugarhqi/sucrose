sucrose.models.lineChart = function() {

  //============================================================
  // Public Variables with Default Settings
  //------------------------------------------------------------

  var margin = {top: 10, right: 10, bottom: 10, left: 10},
      width = null,
      height = null,
      showTitle = false,
      showControls = false,
      showLegend = true,
      direction = 'ltr',
      tooltip = null,
      duration = 0,
      tooltips = true,
      x,
      y,
      state = {},
      strings = {
        legend: {close: 'Hide legend', open: 'Show legend'},
        controls: {close: 'Hide controls', open: 'Show controls'},
        noData: 'No Data Available.',
        noLabel: 'undefined'
      },
      pointRadius = 3,
      dispatch = d3.dispatch('chartClick', 'tooltipShow', 'tooltipHide', 'tooltipMove', 'stateChange', 'changeState');

  //============================================================
  // Private Variables
  //------------------------------------------------------------

  var lines = sucrose.models.line()
        .clipEdge(true),
      xAxis = sucrose.models.axis(),
      yAxis = sucrose.models.axis(),
      legend = sucrose.models.legend()
        .align('right'),
      controls = sucrose.models.legend()
        .align('left')
        .color(['#444']);

  var tooltipContent = function(key, x, y, e, graph) {
        return '<h3>' + key + '</h3>' +
               '<p>' + y + ' on ' + x + '</p>';
      };

  var showTooltip = function(eo, offsetElement) {
        var key = eo.series.key,
            x = lines.x()(eo.point, eo.pointIndex),
            y = lines.y()(eo.point, eo.pointIndex),
            content = tooltipContent(key, x, y, eo, chart);

        tooltip = sucrose.tooltip.show(eo.e, content, null, null, offsetElement);
      };

  //============================================================

  function chart(selection) {

    selection.each(function(chartData) {

      var that = this,
          container = d3.select(this);

      var properties = chartData ? chartData.properties : {},
          data = chartData ? chartData.data : null,
          labels = properties.labels ? properties.labels.map(function(d) { return d.l || d; }) : [];

      var availableWidth = width;
      var availableHeight = height;

      var lineData = [],
          xTickLabels = [],
          totalAmount = 0,
          singlePoint = false,
          showMaxMin = false,
          isArrayData = true,
          xIsDatetime = chartData.properties.xDataType === 'datetime' || false,
          yIsCurrency = chartData.properties.yDataType === 'currency' || false;

      var xValueFormat = function(d, i, selection, noEllipsis) {
            var label = xIsDatetime ?
                          sucrose.utils.dateFormat(d, '%x', chart.locality()) :
                          isNaN(parseInt(d, 10)) || !xTickLabels || !Array.isArray(xTickLabels) ?
                            d :
                            xTickLabels[parseInt(d, 10)];
            return label;
          };

      var yValueFormat = function(d) {
            return sucrose.utils.numberFormatSI(d, 2, yIsCurrency, chart.locality());
          };

      chart.update = function() {
        container.transition().duration(duration).call(chart);
      };

      chart.container = this;

      //------------------------------------------------------------
      // Private method for displaying no data message.

      function displayNoData(d) {
        if (d && d.length && d.filter(function(d) { return d.values.length; }).length) {
          container.selectAll('.sc-no-data').remove();
          return false;
        }

        container.select('.sucrose.sc-wrap').remove();

        var w = width || parseInt(container.style('width'), 10) || 960,
            h = height || parseInt(container.style('height'), 10) || 400,
            noDataText = container.selectAll('.sc-no-data').data([chart.strings().noData]);

        noDataText.enter().append('text')
          .attr('class', 'sucrose sc-no-data')
          .attr('dy', '-.7em')
          .style('text-anchor', 'middle');

        noDataText
          .attr('x', margin.left + w / 2)
          .attr('y', margin.top + h / 2)
          .text(function(d) {
            return d;
          });

        return true;
      }

      // Check to see if there's nothing to show.
      if (displayNoData(data)) {
        return chart;
      }

      //------------------------------------------------------------
      // Process data

      isArrayData = Array.isArray(data[0].values[0]);
      if (isArrayData) {
        lines.x(function(d) { return d ? d[0] : 0; });
        lines.y(function(d) { return d ? d[1] : 0; });
      } else {
        lines.x(function(d) { return d.x; });
        lines.y(function(d) { return d.y; });
      }

      // set title display option
      showTitle = showTitle && properties.title;

      // add series index to each data point for reference
      // and disable data series if total is zero
      data.map(function(d, i) {
        d.series = i;
        d.total = d3.sum(d.values, function(d, i) {
          return lines.y()(d, i);
        });
        if (!d.total) {
          d.disabled = true;
        }
      });

      xTickLabels = properties.labels ?
          properties.labels.map(function(d) { return [].concat(d.l)[0] || chart.strings().noLabel; }) :
          [];

      // TODO: what if the dimension is a numerical range?
      // xValuesAreDates = xTickLabels.length ?
      //       sucrose.utils.isValidDate(xTickLabels[0]) :
      //       sucrose.utils.isValidDate(lines.x()(data[0].values[0]));
      // xValuesAreDates = isArrayData && sucrose.utils.isValidDate(data[0].values[0][0]);

      // SAVE FOR LATER
      // isOrdinalSeries = !xValuesAreDates && labels.length > 0 && d3.min(lineData, function(d) {
      //   return d3.min(d.values, function(d, i) {
      //     return lines.x()(d, i);
      //   });
      // }) > 0;

      lineData = data.filter(function(d) {
          return !d.disabled;
        });

      // safety array
      lineData = lineData.length ? lineData : [{series: 0, total: 0, disabled: true, values: []}];

      totalAmount = d3.sum(lineData, function(d) {
          return d.total;
        });

      //------------------------------------------------------------
      // Display No Data message if there's nothing to show.

      if (!totalAmount) {
        displayNoData();
        return chart;
      }

      // set state.disabled
      state.disabled = lineData.map(function(d) { return !!d.disabled; });
      state.interpolate = lines.interpolate();
      state.isArea = lines.isArea()();

      var controlsData = [
        { key: 'Linear', disabled: lines.interpolate() !== 'linear' },
        { key: 'Basis', disabled: lines.interpolate() !== 'basis' },
        { key: 'Monotone', disabled: lines.interpolate() !== 'monotone' },
        { key: 'Cardinal', disabled: lines.interpolate() !== 'cardinal' },
        { key: 'Line', disabled: lines.isArea()() === true },
        { key: 'Area', disabled: lines.isArea()() === false }
      ];

      //------------------------------------------------------------
      // Setup Scales and Axes

      // Are all data series single points
      singlePoint = d3.max(lineData, function(d) {
          return d.values.length;
        }) === 1;

      lines
        //TODO: we need to reconsider use of padData
        // .padData(singlePoint ? false : true)
        // .padDataOuter(-1)
        .singlePoint(singlePoint)
        // set x-scale as time instead of linear
        .xScale(xIsDatetime && !xTickLabels.length ? d3.scaleTime() : d3.scaleLinear());

      if (singlePoint) {

        var xValues = d3.merge(lineData.map(function(d) {
                return d.values.map(function(d, i) {
                  return lines.x()(d, i);
                });
              }))
              .reduce(function(p, c) {
                if (p.indexOf(c) < 0) p.push(c);
                return p;
              }, [])
              .sort(function(a, b) {
                return a - b;
              }),
            xExtents = d3.extent(xValues),
            xOffset = 1 * (xIsDatetime && !xTickLabels.length ? 86400000 : 1);

        var yValues = d3.merge(lineData.map(function(d) {
                return d.values.map(function(d, i) {
                  return lines.y()(d, i);
                });
              })),
            yExtents = d3.extent(yValues),
            yOffset = lineData.length === 1 ? 2 : Math.min((yExtents[1] - yExtents[0]) / lineData.length, yExtents[0]);

        lines
          .xDomain([
            xExtents[0] - xOffset,
            xExtents[1] + xOffset
          ])
          .yDomain([
            yExtents[0] - yOffset,
            yExtents[1] + yOffset
          ]);

        xAxis
          .orient('bottom')
          .highlightZero(false)
          .showMaxMin(false)
          .ticks(xValues.length)
          .tickValues(xValues)
          .showMaxMin(false);
        yAxis
          .orient('left')
          .ticks(singlePoint ? 5 : null) //TODO: why 5?
          .showMaxMin(false)
          .highlightZero(false);

      } else {

        lines
          .xDomain(null)  //?why null?
          .yDomain(null);
        xAxis
          .orient('bottom')
          .ticks(null)
          .tickValues(null)
          .showMaxMin(xIsDatetime)
          .highlightZero(false);
        yAxis
          .orient('left')
          .ticks(null)
          .showMaxMin(true)
          .highlightZero(true);

      }

      x = lines.xScale();
      y = lines.yScale();

      xAxis
        .scale(x)
        .tickPadding(6)
        .valueFormat(xValueFormat);
      yAxis
        .scale(y)
        .tickPadding(6)
        .valueFormat(yValueFormat);

      //------------------------------------------------------------
      // Main chart draw

      chart.render = function() {

        // Chart layout variables
        var renderWidth, renderHeight, innerMargin, innerWidth, innerHeight;

        renderWidth = width || parseInt(container.style('width'), 10) || 960;
        renderHeight = height || parseInt(container.style('height'), 10) || 400;
        availableWidth = renderWidth - margin.left - margin.right;
        availableHeight = renderHeight - margin.top - margin.bottom;
        innerMargin = {top: 0, right: 0, bottom: 0, left: 0};
        innerHeight = availableHeight - innerMargin.top - innerMargin.bottom;
        innerWidth = availableWidth - innerMargin.left - innerMargin.right;

        // Header variables
        var maxControlsWidth = 0,
            maxLegendWidth = 0,
            widthRatio = 0,
            headerHeight = 0,
            titleBBox = {width: 0, height: 0},
            controlsHeight = 0,
            legendHeight = 0,
            trans = '';

        var wrap_bind = container.selectAll('g.sc-chart-wrap').data([lineData]);
        var wrap_entr = wrap_bind.enter().append('g').attr('class', 'sc-chart-wrap sc-chart-line');
        var wrap = container.select('.sc-chart-wrap').merge(wrap_entr);

        wrap_entr.append('rect').attr('class', 'sc-background')
          .attr('x', -margin.left)
          .attr('y', -margin.top)
          .attr('fill', '#FFF');

        wrap.select('.sc-background')
          .attr('width', availableWidth + margin.left + margin.right)
          .attr('height', availableHeight + margin.top + margin.bottom);

        wrap_entr.append('g').attr('class', 'sc-title-wrap');
        var title_wrap = wrap.select('.sc-title-wrap');

        wrap_entr.append('g').attr('class', 'sc-axis-wrap sc-axis-x');
        var xAxis_wrap = wrap.select('.sc-axis-wrap.sc-axis-x');
        wrap_entr.append('g').attr('class', 'sc-axis-wrap sc-axis-y');
        var yAxis_wrap = wrap.select('.sc-axis-wrap.sc-axis-y');

        wrap_entr.append('g').attr('class', 'sc-lines-wrap');
        var lines_wrap = wrap.select('.sc-lines-wrap');

        wrap_entr.append('g').attr('class', 'sc-controls-wrap');
        var controls_wrap = wrap.select('.sc-controls-wrap');
        wrap_entr.append('g').attr('class', 'sc-legend-wrap');
        var legend_wrap = wrap.select('.sc-legend-wrap');

        wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

        //------------------------------------------------------------
        // Title & Legend & Controls

        title_wrap.select('.sc-title').remove();

        if (showTitle) {
          title_wrap
            .append('text')
              .attr('class', 'sc-title')
              .attr('x', direction === 'rtl' ? availableWidth : 0)
              .attr('y', 0)
              .attr('dy', '.75em')
              .attr('text-anchor', 'start')
              .attr('stroke', 'none')
              .attr('fill', 'black')
              .text(properties.title);

          titleBBox = sucrose.utils.getTextBBox(title_wrap.select('.sc-title'));
          headerHeight += titleBBox.height;
        }

        if (showControls) {
          controls
            .id('controls_' + chart.id())
            .strings(chart.strings().controls)
            .align('left')
            .height(availableHeight - headerHeight);
          controls_wrap
            .datum(controlsData)
            .call(controls);

          maxControlsWidth = controls.calculateWidth();
        }

        if (showLegend) {
          legend
            .id('legend_' + chart.id())
            .strings(chart.strings().legend)
            .align('right')
            .height(availableHeight - headerHeight);
          legend_wrap
            .datum(data)
            .call(legend);

          maxLegendWidth = legend.calculateWidth();
        }

        // calculate proportional available space
        widthRatio = availableWidth / (maxControlsWidth + maxLegendWidth);
        maxControlsWidth = Math.floor(maxControlsWidth * widthRatio);
        maxLegendWidth = Math.floor(maxLegendWidth * widthRatio);

        if (showControls) {
          controls
            .arrange(maxControlsWidth);
          maxLegendWidth = availableWidth - controls.width();
        }
        if (showLegend) {
          legend
            .arrange(maxLegendWidth);
          maxControlsWidth = availableWidth - legend.width();
        }

        if (showControls) {
          var xpos = direction === 'rtl' ? availableWidth - controls.width() : 0,
              ypos = showTitle ? titleBBox.height : - controls.margin().top;
          controls_wrap
            .attr('transform', 'translate(' + xpos + ',' + ypos + ')');
          controlsHeight = controls.height();
        }

        if (showLegend) {
          var legendLinkBBox = sucrose.utils.getTextBBox(legend_wrap.select('.sc-legend-link')),
              legendSpace = availableWidth - titleBBox.width - 6,
              legendTop = showTitle && !showControls && legend.collapsed() && legendSpace > legendLinkBBox.width ? true : false,
              xpos = direction === 'rtl' ? 0 : availableWidth - legend.width(),
              ypos = titleBBox.height;
          if (legendTop) {
            ypos = titleBBox.height - legend.height() / 2 - legendLinkBBox.height / 2;
          } else if (!showTitle) {
            ypos = - legend.margin().top;
          }
          legend_wrap
            .attr('transform', 'translate(' + xpos + ',' + ypos + ')');
          legendHeight = legendTop ? 12 : legend.height();
        }

        // Recalc inner margins based on legend and control height
        headerHeight += Math.max(controlsHeight, legendHeight);
        innerHeight = availableHeight - headerHeight - innerMargin.top - innerMargin.bottom;

        //------------------------------------------------------------
        // Main Chart Component(s)

        var pointSize = Math.pow(pointRadius, 2) * Math.PI * (singlePoint ? 3 : 1);

        lines
          .width(innerWidth)
          .height(innerHeight)
          .id(chart.id())
          .size(pointSize) // default size set to 3
          .sizeRange([pointSize, pointSize])
          .sizeDomain([pointSize, pointSize]); //set to speed up calculation, needs to be unset if there is a custom size accessor
        lines_wrap
          .datum(lineData)
          .call(lines);


        //------------------------------------------------------------
        // Setup Axes

        var yAxisMargin = {top: 0, right: 0, bottom: 0, left: 0},
            xAxisMargin = {top: 0, right: 0, bottom: 0, left: 0};

        function setInnerMargins() {
          innerMargin.left = Math.max(xAxisMargin.left, yAxisMargin.left);
          innerMargin.right = Math.max(xAxisMargin.right, yAxisMargin.right);
          innerMargin.top = Math.max(xAxisMargin.top, yAxisMargin.top);
          innerMargin.bottom = Math.max(xAxisMargin.bottom, yAxisMargin.bottom);
        }

        function setInnerDimensions() {
          innerWidth = availableWidth - innerMargin.left - innerMargin.right;
          innerHeight = availableHeight - headerHeight - innerMargin.top - innerMargin.bottom;
          // Recalc chart dimensions and scales based on new inner dimensions
          lines.width(innerWidth).height(innerHeight);
          // This resets the scales for the whole chart
          // unfortunately we can't call this without until line instance is called
          lines.scatter.resetDimensions(innerWidth, innerHeight);
        }

        // Y-Axis
        yAxis
          .margin(innerMargin)
          .tickFormat(function(d, i) {
            return yAxis.valueFormat()(d, yIsCurrency);
          });
        yAxis_wrap
          .call(yAxis);
        // reset inner dimensions
        yAxisMargin = yAxis.margin();
        setInnerMargins();
        setInnerDimensions();

        // X-Axis
        // resize ticks based on new dimensions
        xAxis
          .tickSize(-innerHeight + (lines.padData() ? pointRadius : 0), 0)
          .margin(innerMargin)
          .tickFormat(function(d, i, noEllipsis) {
            return xAxis.valueFormat()(d - !isArrayData, xTickLabels, xIsDatetime);
          });
        xAxis_wrap
          .call(xAxis);
        xAxisMargin = xAxis.margin();
        setInnerMargins();
        setInnerDimensions();
        // xAxis
        //   .resizeTickLines(-innerHeight + (lines.padData() ? pointRadius : 0));

        // recall y-axis, x-axis and lines to set final size based on new dimensions
        yAxis
          .tickSize(-innerWidth + (lines.padData() ? pointRadius : 0), 0)
          .margin(innerMargin);
        yAxis_wrap
          .call(yAxis);

        xAxis
          .tickSize(-innerHeight + (lines.padData() ? pointRadius : 0), 0)
          .margin(innerMargin);
        xAxis_wrap
          .call(xAxis);

        lines
          .width(innerWidth)
          .height(innerHeight);
        lines_wrap
          .datum(lineData)
          .call(lines);

        // final call to lines based on new dimensions
        // lines_wrap
        //   .transition().duration(duration)
        //     .call(lines);

        //------------------------------------------------------------
        // Final repositioning

        innerMargin.top += headerHeight;

        trans = innerMargin.left + ',';
        trans += innerMargin.top + (xAxis.orient() === 'bottom' ? innerHeight : 0);
        xAxis_wrap
          .attr('transform', 'translate(' + trans + ')');

        trans = innerMargin.left + (yAxis.orient() === 'left' ? 0 : innerWidth) + ',';
        trans += innerMargin.top;
        yAxis_wrap
          .attr('transform', 'translate(' + trans + ')');

        trans = innerMargin.left + ',' + innerMargin.top;
        lines_wrap
          .attr('transform', 'translate(' + trans + ')');

      };

      //============================================================

      chart.render();

      //============================================================
      // Event Handling/Dispatching (in chart's scope)
      //------------------------------------------------------------

      legend.dispatch.on('legendClick', function(d, i) {
        d.disabled = !d.disabled;

        if (!data.filter(function(d) { return !d.disabled; }).length) {
          data.map(function(d) {
            d.disabled = false;
            container.selectAll('.sc-series').classed('disabled', false);
            return d;
          });
        }

        state.disabled = data.map(function(d) { return !!d.disabled; });
        dispatch.call('stateChange', this, state);

        container.transition().duration(duration).call(chart);
      });

      controls.dispatch.on('legendClick', function(d, i) {
        //if the option is currently enabled (i.e., selected)
        if (!d.disabled) {
          return;
        }

        //set the controls all to false
        controlsData = controlsData.map(function(s) {
          s.disabled = true;
          return s;
        });
        //activate the the selected control option
        d.disabled = false;

        switch (d.key) {
          case 'Basis':
            lines.interpolate('basis');
            break;
          case 'Linear':
            lines.interpolate('linear');
            break;
          case 'Monotone':
            lines.interpolate('monotone');
            break;
          case 'Cardinal':
            lines.interpolate('cardinal');
            break;
          case 'Line':
            lines.isArea(false);
            break;
          case 'Area':
            lines.isArea(true);
            break;
        }

        state.interpolate = lines.interpolate();
        state.isArea = lines.isArea();
        dispatch.call('stateChange', this, state);

        container.transition().duration(duration).call(chart);
      });

      dispatch.on('tooltipShow', function(eo) {
        if (tooltips) {
          showTooltip(eo, that.parentNode);
        }
      });

      dispatch.on('tooltipMove', function(e) {
        if (tooltip) {
          sucrose.tooltip.position(that.parentNode, tooltip, e, 's');
        }
      });

      dispatch.on('tooltipHide', function() {
        if (tooltips) {
          sucrose.tooltip.cleanup();
        }
      });

      // Update chart from a state object passed to event handler
      dispatch.on('changeState', function(eo) {
        if (typeof eo.disabled !== 'undefined') {
          data.forEach(function(series, i) {
            series.disabled = eo.disabled[i];
          });
          state.disabled = eo.disabled;
        }

        if (typeof eo.interpolate !== 'undefined') {
          lines.interpolate(eo.interpolate);
          state.interpolate = eo.interpolate;
        }

        if (typeof eo.isArea !== 'undefined') {
          lines.isArea(eo.isArea);
          state.isArea = eo.isArea;
        }

        container.transition().duration(duration).call(chart);
      });

      dispatch.on('chartClick', function() {
        if (controls.enabled()) {
          controls.dispatch.call('closeMenu', this);
        }
        if (legend.enabled()) {
          legend.dispatch.call('closeMenu', this);
        }
      });

    });

    return chart;
  }

  //============================================================
  // Event Handling/Dispatching (out of chart's scope)
  //------------------------------------------------------------

  lines.dispatch.on('elementMouseover.tooltip', function(eo) {
    dispatch.call('tooltipShow', this, eo);
  });

  lines.dispatch.on('elementMousemove.tooltip', function(e) {
    dispatch.call('tooltipMove', this, e);
  });

  lines.dispatch.on('elementMouseout.tooltip', function() {
    dispatch.call('tooltipHide', this);
  });

  //============================================================
  // Expose Public Variables
  //------------------------------------------------------------

  // expose chart's sub-components
  chart.dispatch = dispatch;
  chart.lines = lines;
  chart.legend = legend;
  chart.controls = controls;
  chart.xAxis = xAxis;
  chart.yAxis = yAxis;

  fc.rebind(chart, lines, 'id', 'x', 'y', 'xScale', 'yScale', 'xDomain', 'yDomain', 'forceX', 'forceY', 'clipEdge', 'delay', 'color', 'fill', 'classes', 'gradient', 'locality');
  fc.rebind(chart, lines, 'defined', 'isArea', 'interpolate', 'size', 'clipVoronoi', 'useVoronoi', 'interactive', 'nice');
  fc.rebind(chart, xAxis, 'rotateTicks', 'reduceXTicks', 'staggerTicks', 'wrapTicks');

  chart.colorData = function(_) {
    var type = arguments[0],
        params = arguments[1] || {};
    var color = function(d, i) {
          return sucrose.utils.defaultColor()(d, d.series);
        };
    var classes = function(d, i) {
          return 'sc-group sc-series-' + d.series;
        };

    switch (type) {
      case 'graduated':
        color = function(d, i) {
          return d3.interpolateHsl(d3.rgb(params.c1), d3.rgb(params.c2))(d.series / params.l);
        };
        break;
      case 'class':
        color = function() {
          return 'inherit';
        };
        classes = function(d, i) {
          var iClass = (d.series * (params.step || 1)) % 14;
          iClass = (iClass > 9 ? '' : '0') + iClass;
          return 'sc-group sc-series-' + d.series + ' sc-fill' + iClass + ' sc-stroke' + iClass;
        };
        break;
      case 'data':
        color = function(d, i) {
          return d.color || sucrose.utils.defaultColor()(d, d.series);
        };
        classes = function(d, i) {
          return 'sc-group sc-series-' + d.series + (d.classes ? ' ' + d.classes : '');
        };
        break;
    }

    var fill = (!params.gradient) ? color : function(d, i) {
      var p = {orientation: params.orientation || 'horizontal', position: params.position || 'base'};
      return lines.gradient(d, d.series, p);
    };

    lines.color(color);
    lines.fill(fill);
    lines.classes(classes);

    legend.color(color);
    legend.classes(classes);

    return chart;
  };

  chart.margin = function(_) {
    if (!arguments.length) {
      return margin;
    }
    for (var prop in _) {
      if (_.hasOwnProperty(prop)) {
        margin[prop] = _[prop];
      }
    }
    return chart;
  };

  chart.width = function(_) {
    if (!arguments.length) {
      return width;
    }
    width = _;
    return chart;
  };

  chart.height = function(_) {
    if (!arguments.length) {
      return height;
    }
    height = _;
    return chart;
  };

  chart.showTitle = function(_) {
    if (!arguments.length) {
      return showTitle;
    }
    showTitle = _;
    return chart;
  };

  chart.showControls = function(_) {
    if (!arguments.length) {
      return showControls;
    }
    showControls = _;
    return chart;
  };

  chart.showLegend = function(_) {
    if (!arguments.length) {
      return showLegend;
    }
    showLegend = _;
    return chart;
  };

  chart.tooltip = function(_) {
    if (!arguments.length) {
      return tooltip;
    }
    tooltip = _;
    return chart;
  };

  chart.tooltips = function(_) {
    if (!arguments.length) {
      return tooltips;
    }
    tooltips = _;
    return chart;
  };

  chart.tooltipContent = function(_) {
    if (!arguments.length) {
      return tooltipContent;
    }
    tooltipContent = _;
    return chart;
  };

  chart.state = function(_) {
    if (!arguments.length) {
      return state;
    }
    state = _;
    return chart;
  };

  chart.strings = function(_) {
    if (!arguments.length) {
      return strings;
    }
    for (var prop in _) {
      if (_.hasOwnProperty(prop)) {
        strings[prop] = _[prop];
      }
    }
    return chart;
  };

  chart.direction = function(_) {
    if (!arguments.length) {
      return direction;
    }
    direction = _;
    yAxis.direction(_);
    xAxis.direction(_);
    legend.direction(_);
    controls.direction(_);
    return chart;
  };

  chart.duration = function(_) {
    if (!arguments.length) { return duration; }
    duration = _;
    lines.duration(_);
    return chart;
  };

  //============================================================

  return chart;
};