sucrose.models.pieChart = function() {

  //============================================================
  // Public Variables with Default Settings
  //------------------------------------------------------------

  var margin = {top: 10, right: 10, bottom: 10, left: 10},
      width = null,
      height = null,
      showTitle = false,
      showLegend = true,
      direction = 'ltr',
      tooltip = null,
      tooltips = true,
      duration = 0,
      state = {},
      strings = {
        legend: {close: 'Hide legend', open: 'Show legend'},
        noData: 'No Data Available.',
        noLabel: 'undefined'
      },
      dispatch = d3.dispatch('chartClick', 'elementClick', 'tooltipShow', 'tooltipHide', 'tooltipMove', 'stateChange', 'changeState');

  //============================================================
  // Private Variables
  //------------------------------------------------------------

  var model = pie = sucrose.models.pie(),
      legend = sucrose.models.legend().align('center');

  var tooltipContent = function(key, x, y, e, graph) {
        return '<h3>' + key + ' - ' + x + '</h3>' +
               '<p>' + y + '</p>';
      };

  var showTooltip = function(eo, offsetElement, properties) {
        var key = model.getKey()(eo),
            x = properties.total ? (model.getValue()(eo.point) * 100 / properties.total).toFixed(1) : 100,
            y = model.getValue()(eo.point),
            content = tooltipContent(key, x, y, eo, chart);
        return sucrose.tooltip.show(eo.e, content, null, null, offsetElement);
      };

  var seriesClick = function(data, e, chart) {
        return;
      };

  //============================================================

  function chart(selection) {

    selection.each(function(chartData) {

      var that = this,
          container = d3.select(this),
          modelClass = 'pie';

      var properties = chartData ? chartData.properties : {},
          data = chartData ? chartData.data : null;

      var availableWidth = width || parseInt(container.style('width'), 10) || 960;
      var availableHeight = height || parseInt(container.style('height'), 10) || 400;

      var xIsDatetime = chartData.properties.xDataType === 'datetime' || false,
          yIsCurrency = chartData.properties.yDataType === 'currency' || false;

      chart.update = function() {
        container.transition().duration(duration).call(chart);
      };

      chart.container = this;

      //------------------------------------------------------------
      // Private method for displaying no data message.

      function displayNoData(d) {
        var noDataText = d && d.length ? [] : [chart.strings().noData];
        var noData_bind = container.selectAll('.sc-no-data').data(noDataText);
        var noData_entr = noData_bind.enter().append('text')
              .attr('class', 'sucrose sc-no-data')
              .attr('dy', '-.7em')
              .style('text-anchor', 'middle');
        noData_bind.exit().remove();
        var noData = container.selectAll('.sc-no-data').merge(noData_entr);
        noData
          .attr('x', margin.left + availableWidth / 2)
          .attr('y', margin.top + availableHeight / 2)
          .text(sucrose.identity);

        if (noDataText.length) {
          return true;
          container.select('.sucrose.sc-wrap').remove();
        }
        return false;
      }

      // Check to see if there's nothing to show.
      if (displayNoData(data)) {
        return chart;
      }

      //------------------------------------------------------------
      // Process data

      chart.dataSeriesActivate = function(eo) {
        var series = eo.point;

        series.active = (!series.active || series.active === 'inactive') ? 'active' : 'inactive';

        // if you have activated a data series, inactivate the rest
        if (series.active === 'active') {
          data
            .filter(function(d) {
              return d.active !== 'active';
            })
            .map(function(d) {
              d.active = 'inactive';
              return d;
            });
        }

        // if there are no active data series, inactivate them all
        if (!data.filter(function(d) { return d.active === 'active'; }).length) {
          data.map(function(d) {
            d.active = '';
            return d;
          });
        }

        container.call(chart);
      };

      // add series index to each data point for reference
      data.forEach(function(s, i) {
        var y = model.y();
        s.series = i;

        if (!s.value && !s.values) {
          s.values = [];
        } else if (s.values) {
          s.values.forEach(function(p, i) {
            p.series = s.series;
            p.index = i;
            if (typeof p.value == 'undefined') {
              p.value = y(p);
            }
          });
        } else {
          s.values = [parseInt(s.value, 10)];
        }

        s.value = s.total = s.value || d3.sum(s.values, function(p) { return p.value; });
        s.count = s.count || s.values.length;
        s.disabled = s.disabled || s.value === 0;
      });

      // only sum enabled series
      var modelData = data.filter(function(d, i) { return !d.disabled; });

      if (!modelData.length) {
        modelData = [{values: []}]; // safety array
      }

      var totalCount = d3.sum(modelData, function(d) { return d.count; });
      properties.count = totalCount;

      var totalAmount = d3.sum(modelData, function(d) { return d.total; });
      properties.total = totalAmount;

      // set title display option
      showTitle = showTitle && properties.title;

      //set state.disabled
      state.disabled = data.map(function(d) { return !!d.disabled; });

      //------------------------------------------------------------
      // Display No Data message if there's nothing to show.

      if (!totalAmount) {
        displayNoData();
        return chart;
      }

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
        var maxLegendWidth = 0,
            headerHeight = 0,
            titleBBox = {width: 0, height: 0},
            legendHeight = 0,
            trans = '';

        //------------------------------------------------------------
        // Setup containers and skeleton of chart

        var wrap_bind = container.selectAll('g.sc-chart-wrap').data([modelData]);
        var wrap_entr = wrap_bind.enter().append('g').attr('class', 'sc-chart-wrap sc-' + modelClass + '-chart');
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

        wrap_entr.append('g').attr('class', 'sc-' + modelClass + '-wrap');
        var model_wrap = wrap.select('.sc-' + modelClass + '-wrap');

        wrap_entr.append('g').attr('class', 'sc-legend-wrap');
        var legend_wrap = wrap.select('.sc-legend-wrap');

        wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

        //------------------------------------------------------------
        // Title & Legend

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

        if (showLegend) {
          legend
            .id('legend_' + chart.id())
            .strings(chart.strings().legend)
            .align('center')
            .height(availableHeight - innerMargin.top);
          legend_wrap
            .datum(data)
            .call(legend);
          legend
            .arrange(availableWidth);

          var legendLinkBBox = sucrose.utils.getTextBBox(legend_wrap.select('.sc-legend-link')),
              legendSpace = availableWidth - titleBBox.width - 6,
              legendTop = showTitle && legend.collapsed() && legendSpace > legendLinkBBox.width ? true : false,
              xpos = direction === 'rtl' || !legend.collapsed() ? 0 : availableWidth - legend.width(),
              ypos = titleBBox.height;

          if (legendTop) {
            ypos = titleBBox.height - legend.height() / 2 - legendLinkBBox.height / 2;
          } else if (!showTitle) {
            ypos = - legend.margin().top;
          }

          legend_wrap
            .attr('transform', 'translate(' + xpos + ',' + ypos + ')');

          legendHeight = legendTop ? 12 : legend.height() - (showTitle ? 0 : legend.margin().top);
        }

        // Recalc inner margins based on title and legend height
        headerHeight += legendHeight;
        innerMargin.top += headerHeight;
        innerHeight = availableHeight - innerMargin.top - innerMargin.bottom;
        innerWidth = availableWidth - innerMargin.left - innerMargin.right;

        //------------------------------------------------------------
        // Main Chart Component(s)

        model
          .width(innerWidth)
          .height(innerHeight);

        model_wrap
          .datum(modelData)
          .attr('transform', 'translate(' + innerMargin.left + ',' + innerMargin.top + ')')
          .transition().duration(duration)
            .call(model);

      };

      //============================================================

      chart.render();

      //============================================================
      // Event Handling/Dispatching (in chart's scope)
      //------------------------------------------------------------

      legend.dispatch.on('legendClick', function(d, i) {
        d.disabled = !d.disabled;
        d.active = false;

        // if there are no enabled data series, enable them all
        if (!data.filter(function(d) { return !d.disabled; }).length) {
          data.map(function(d) {
            d.disabled = false;
            return d;
          });
        }

        // if there are no active data series, activate them all
        if (!data.filter(function(d) { return d.active === 'active'; }).length) {
          data.map(function(d) {
            d.active = '';
            return d;
          });
        }

        state.disabled = data.map(function(d) { return !!d.disabled; });
        dispatch.call('stateChange', this, state);

        container.transition().duration(duration).call(chart);
      });

      dispatch.on('tooltipShow', function(eo) {
        if (tooltips) {
          tooltip = showTooltip(eo, that.parentNode, properties);
        }
      });

      dispatch.on('tooltipMove', function(e) {
        if (tooltip) {
          sucrose.tooltip.position(that.parentNode, tooltip, e);
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
          modelData.forEach(function(series, i) {
            series.disabled = eo.disabled[i];
          });
          state.disabled = eo.disabled;
        }

        container.transition().duration(duration).call(chart);
      });

      dispatch.on('chartClick', function() {
        if (legend.enabled()) {
          legend.dispatch.call('closeMenu', this);
        }
      });

      model.dispatch.on('elementClick', function(eo) {
        dispatch.call('chartClick', this);
        seriesClick(data, eo, chart);
      });

    });

    return chart;
  }

  //============================================================
  // Event Handling/Dispatching (out of chart's scope)
  //------------------------------------------------------------

  model.dispatch.on('elementMouseover.tooltip', function(eo) {
    dispatch.call('tooltipShow', this, eo);
  });

  model.dispatch.on('elementMousemove.tooltip', function(e) {
    dispatch.call('tooltipMove', this, e);
  });

  model.dispatch.on('elementMouseout.tooltip', function() {
    dispatch.call('tooltipHide', this);
  });

  //============================================================
  // Expose Public Variables
  //------------------------------------------------------------

  // expose chart's sub-components
  chart.dispatch = dispatch;
  chart.pie = pie;
  chart.legend = legend;

  fc.rebind(chart, pie, 'id', 'x', 'y', 'color', 'fill', 'classes', 'gradient', 'locality');
  fc.rebind(chart, pie, 'valueFormat', 'labelFormat', 'values', 'description', 'showLabels', 'showLeaders', 'donutLabelsOutside', 'pieLabelsOutside', 'labelThreshold', 'textureFill');
  fc.rebind(chart, pie, 'arcDegrees', 'rotateDegrees', 'minRadius', 'maxRadius', 'fixedRadius', 'startAngle', 'endAngle', 'donut', 'hole', 'holeFormat', 'donutRatio');

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
          return 'sc-group sc-series-' + d.series + ' sc-fill' + iClass;
        };
        break;
      case 'data':
        color = function(d, i) {
          return d.classes ? 'inherit' : d.color || sucrose.utils.defaultColor()(d, d.series);
        };
        classes = function(d, i) {
          return 'sc-group sc-series-' + d.series + (d.classes ? ' ' + d.classes : '');
        };
        break;
    }

    var fill = (!params.gradient) ? color : function(d, i) {
      return pie.gradient(d, d.series);
    };

    model.color(color);
    model.fill(fill);
    model.classes(classes);

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
    model.direction(_);
    legend.direction(_);
    return chart;
  };

  chart.seriesClick = function(_) {
    if (!arguments.length) {
      return seriesClick;
    }
    seriesClick = _;
    return chart;
  };

  chart.colorFill = function(_) {
    return chart;
  };

  //============================================================

  return chart;
};