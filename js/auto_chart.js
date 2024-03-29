var app = angular.module('AutoChartApp', []);
app.controller('AutomateChart', function($scope, $http) {

    //List of csv examples to pick from
    $scope.exampleDataSets = [];

    //The CSV example that the user has selected but not picked yet
    $scope.selectedCsvExample = null;

    //Data that we are going to work with
    $scope.loadedCsvData = [];

    $scope.tableData = [];

    $scope.chartData = [];

    $scope.autoDCCrossfilter = null;

      //"Browse for CSV" button
    $("#csv").bind("change", function(event) {
        var reader = new FileReader();
        reader.onload = function(theFile) {
            try {
                $scope.loadedCsvData = Papa.parse(theFile.target.result, {
                    header: true,
                    dynamicTyping: true
                }).data;
                $scope.generateTableData($scope.loadedCsvData)
                $scope.$apply();
            } catch (e) {
                alert("CSV Parse error.");
                return;
            }
        };
        reader.readAsText(event.target.files[0]);
    });

    $scope.chartTypeChanged = function(row) {
        switch (row.chartType) {
            case 'bar':
                row.dataType = 'number'
                break;
            case 'row':
                row.dataType = 'string'
                break;
            case 'pie':
                row.dataType = 'string'
                break;
            case 'time':
                row.dataType = 'date'
                break;
        }
    }

    //Initializes the configuration data that is used in both the table and the generated charts.
    $scope.generateTableData = function(csvData) {
        //Get the keys of our data. For each key, initialize an object

        $scope.tableData = _.map(_.keys(csvData[0]), function(key) {
                //Default values
                var rowObject = {
                    columnName: key,
                    chart: true,
                    cap: 10,
                    groupBy: false,
                    ordering: true,
                    timeScale: 'weeks',
                    colorScale: "category10"
                }

                //Grab a random data point from this input data column
                var randomSample = _.sample(csvData)[key]

                //Set the chart and datatype depending on that value
                if (_.isString(randomSample)) {
                    rowObject.dataType = 'string'
                    rowObject.chartType = 'row'
                    }
                if (_.isString(randomSample)) {
                    rowObject.dataType = 'string'
                    rowObject.chartType = 'pie'
                    }
                if (_.isNumber(randomSample)) {
                    rowObject.dataType = 'number'
                    rowObject.chartType = 'bar'
                }

                // TODO: Figure out how to be certain that a value is a date and not a string/number
                // if (Date.parse(randomSample) !== NaN) {
                //     rowObject.dataType = 'date'
                //     rowObject.chartType = 'time'
                // }

                return rowObject
            })
            //Set the first row to have the groupBy radio button checked
        $scope.tableData[0].groupBy = true;

        //Reset the charts
        $scope.chartData = []
    }


    //Use the now-modified table data to create the chart objects.
    $scope.generateChartData = function() {

        //Reduce the data needed to chart
        //TODO: Consider not doing this as it causes the output table to only show selected columns. (could be good or bad for the user)
        var newData = [];
        _.each($scope.loadedCsvData, function(row) {
            var newDataObject = {};
            _.each($scope.tableData, function(tableRow) {
                if (tableRow.chart) {
                    newDataObject[tableRow.columnName] = row[tableRow.columnName]
                }

            })
            newData.push(newDataObject)
        })

        $scope.autoDCCrossfilter = crossfilter(newData);

        var newChartData = [];
        var dcDataTableColumns = []

        //Filter to only rows that we need to work add
        var rowsToChart = _.filter($scope.tableData, 'chart')

        //If none of the rows had a "Group By", then force the first one to have it
        var numberOfGroupByRows = _.reduce(rowsToChart, function(sum, d) {
            if (d.groupBy) {
                return sum + 1;
            }
            return sum;
        }, 0)
        if (numberOfGroupByRows < 1) {
            rowsToChart[0].groupBy = true;
        }

        _.each(rowsToChart, function(tableRow) {

            var chartObject = {};
            chartObject.chartType = tableRow.chartType;
            chartObject.cap = tableRow.cap;
            chartObject.ordering = tableRow.ordering;
            chartObject.colorScale = tableRow.colorScale;
            chartObject.groupBy = tableRow.groupBy;
            chartObject.timeScale = tableRow.timeScale;
            chartObject.columnName = tableRow.columnName;

            //Calculate the extent if it's a bar
            if (tableRow.chartType == 'bar' && tableRow.dataType == 'number') {
                var values = _.map(newData, function(d) {
                    return +d[tableRow.columnName]
                })
                chartObject.extent = d3.extent(values)
            }

            //Parse dates into date objects if it's a time
            if (tableRow.chartType == 'time' && tableRow.dataType == 'date') {
                var values = [];
                _.each(newData, function(d) {
                    var inputDate = d[tableRow.columnName]
                    var parsedDate = moment(inputDate, ["MM-DD-YYYY", "YYYY", "YYYY-MM-DD"])
                    var dateObject = parsedDate.toDate()

                    var newDate = null;

                    switch (tableRow.timeScale) {
                        case 'seconds':
                            newDate = d3.time.second(dateObject)
                            break;
                        case 'minutes':
                            newDate = d3.time.minute(dateObject)
                            break;
                        case 'hours':
                            newDate = d3.time.hour(dateObject)
                            break;
                        case 'days':
                            newDate = d3.time.day(dateObject)
                            break;
                        case 'weeks':
                            newDate = d3.time.week(dateObject)
                            break;
                        case 'months':
                            newDate = d3.time.month(dateObject)
                            break;
                        case 'years':
                            newDate = d3.time.year(dateObject)
                            break;
                    }



                    d[tableRow.columnName] = newDate
                    values.push(newDate)
                })
                chartObject.extent = d3.extent(values)
            }

            chartObject.dimension = $scope.autoDCCrossfilter.dimension(function(d) {
                return d[tableRow.columnName]
            })
            chartObject.group = chartObject.dimension.group();
            newChartData.push(chartObject);

            dcDataTableColumns.push({
                label: tableRow.columnName,
                format: function(d) {
                    return d[tableRow.columnName];
                }
            });



        })
        $scope.chartData = newChartData
        $scope.dcCounter = dc.dataCount('#dcCounter');
        $scope.dcCounter.dimension($scope.autoDCCrossfilter).group($scope.autoDCCrossfilter.groupAll())
        $scope.dcDataTable = dc.dataTable('#dcDataTable');

        //Get the orderBy radio button
        var groupByChartColumn = _.find($scope.chartData, 'groupBy')

        $scope.dcDataTable
            .dimension(groupByChartColumn.dimension)
            .group(function(d) {
                return d[groupByChartColumn.columnName];
            })
            .size(50)
            .columns(dcDataTableColumns);

        //Force render the datatable
        dc.redrawAll();

    }

    $scope.saveData = function() {
        var data = $scope.chartData[0].dimension.top(Infinity)
        var outputCSV = Papa.unparse(data)
        var blob = new Blob([outputCSV], { type: "text/csv;charset=utf-8" });
        saveAs(blob, "filtered_data.csv");
    };

})






app.directive('dcChart', function() {
    function link(scope, element, attr) {

        var chartElement = null;
        var margins = {
            top: 20,
            left: 50,
            right: 50,
            bottom: 20
        }

        if (scope.chartType == 'row') {
            chartElement = dc.rowChart(element[0]);
        } else if (scope.chartType == 'bar' || scope.chartType == 'time') {
            margins = {
                top: 20,
                left: 50,
                right: 50,
                bottom: 20
              }
            chartElement = dc.barChart(element[0]);
          } else {
             margins = {
                 top: 20,
                 left: 50,
                 right: 50,
                 bottom: 20
               }
            chartElement = dc.pieChart(element[0]);
          }

        var a = angular.element(element[0].querySelector('a.reset'));
        a.on('click', function() {
            chartElement.filterAll();
            dc.redrawAll();
        });
        a.attr('href', 'javascript:;');
        a.css('display', 'none');


        scope.createChart = function() {
            if (_.keys(scope.dimension).length > 1 && _.keys(scope.group).length > 1) {

                chartElement
                    .width(element[0].parentElement.clientWidth)
                    .height(element[0].parentElement.clientHeight)
//                     .margins(margins)
                    .dimension(scope.dimension)
                    .group(scope.group)


                switch (scope.chartType) {
                    case 'row':
                        if (scope.ordering) {
                            chartElement.ordering(function(d) {
                                return -d.value;
                            })
                        }

                        chartElement
                            .cap(scope.cap)
                            .colors(d3.scale[scope.colorScale]())
                            .elasticX(true)
                            .xAxis()
                            .ticks(6);

                        break;
                    case 'bar':
                        chartElement
                            .elasticY(true)
                            .x(d3.scale.linear().domain(scope.extent))
                            .renderHorizontalGridLines(true)
                            .yAxis().ticks(6);
                        break;
                    case 'time':
                        chartElement
                            .elasticY(true)
                            .xUnits(d3.time[scope.timeScale])
                            .x(d3.time.scale().domain(scope.extent))
                            .renderHorizontalGridLines(true)
                            .yAxis().ticks(4);
                        break;
                    case 'pie':
                    if (scope.ordering) {
                        chartElement.ordering(function(d) {
                            return -d.value;
                        })
                    }
                        chartElement
                            .width(600)
                            .height(250)
                            .innerRadius(70)
                            .colors(d3.scale[scope.colorScale]())
                            .legend(dc.legend().x(20).y(0).gap(5))
                            .on('pretransition', function(pie) {
                              pie.selectAll('text.pie-slice').text(function(d) {
                              return dc.utils.printSingleValue((d.endAngle - d.startAngle) / (2*Math.PI) * 100) + '%';
                          })
                        });
                        break;
                }

                //Fix for not being able to scroll with the mousewheel after a bar chart has been filtered
                //https://github.com/dc-js/dc.js/issues/991
                chartElement._disableMouseZoom = function() {};
                // chartElement.mouseZoomable(false)

                chartElement.render();
            }
        }


        //TODO: Needed?
        var dimension = scope.dimension;
        scope.$watch('dimension', function(dimension) {
            if (dimension) {
                scope.createChart();
            }
        });


        //TODO: Needed?
        var group = scope.group;
        scope.$watch('group', function(group) {
            if (group) {
                scope.createChart();
            }
        });
    }
    return {
        link: link,
        restrict: 'E',
        scope: {
            dimension: '=',
            group: '=',
            extent: '=',
            dataType: '=',
            chartType: '=',
            cap: '=',
            ordering: '=',
            timeScale: '=',
            colorScale: '='

        }
    };
});
