$(function() {
  var BASE_URL = 'http://aramoto.sakura.ne.jp/shizuoka2/'
  var MAP_WIDTH = 900, MAP_HEIGHT = 650;

  var map = d3.select('#map')
    .append('svg').attr({
      width: MAP_WIDTH, height: MAP_HEIGHT
    })

  d3.json(BASE_URL+'/gis/shizuoka_utf8.json', function(json) { // 静岡県地図データ
    map.projection = d3.geo.mercator()
      .scale(15000)
      .center(d3.geo.centroid(json))
      .translate([MAP_WIDTH / 2, MAP_HEIGHT / 2]);
    var path = d3.geo.path().projection(map.projection);

    map.selectAll('path')
      .data(json.features)
      .enter()
      .append('path')
        .attr({
          d: path
        })
        .style({
          fill: 'hsl(0,0%,80%)',
          stroke: 'hsl(80,100%,0%)'
        });

    var tooltip = d3.select('body')
      .append('div')
      .attr({ class: 'tooltip' })
      .style({ opacity: 0 })

    var rainPoints = (function() {
      var info = csvToArray( // 雨量観測局情報
        $.ajax({
          url: BASE_URL+'Shizuoka_Rain_ObservationPoint_utf8.csv',
          async: false
        }).responseText);

      var points = map.selectAll('.rain-point')
        .data(info).enter()
        .append('g')
        .attr({
          id: function(d) {
            return 'rp_' + d.point_id;
          },
          class: 'rain-point',
          transform: function(d) {
            var pos = map.projection([d.longitude/10000, d.latitude/10000]);
            return 'translate(' + pos[0] + ',' + pos[1] + ')';
          }
        });

      points.append('circle')
        .attr({
          class: 'node',
          r: 5
        })
        .style({
          stroke: '#000',
          fill: '#fff'
        });

      points
        .on('mouseover', function(d, event) {
          d.values = d.values || {}
          tooltip
            .html('<dl>'
                  + '<dd class="name">' + d.pointname + '</dd>'
                  + '<dd class="addr">住所:' + (d.address || '--') + '</dd>'
                  + '<dd class="rain">'
                  + '<span>10分雨量 = ' + (d.values.rain_10min || '--') + '</span>'
                  + ' / '
                  + '<span>60分雨量 = ' + (d.values.rain_60min || '--') + '</span>'
                  + '</dd>'
                  + '</dl>')
            .style({
              top: d3.event.pageY+'px',
              left: d3.event.pageX+'px',
              opacity: 1
            });
        })
        .on('mouseout', function(d) {
          tooltip.style({ opacity: 0 });
        });

      return points;
    })();

    loadRainData();
  });

  var loadRainData = function() {
    var datetime = getDatetime(),
        date = datetime[0].split('-').join(''),
        time = datetime[1].replace(':', '').substring(0, 3) + '0'
    console.log(date, time);

    var date = $(':input[name=date]').val().split('-').join('');
    var time = $(':input[name=time]').val().replace(':', '');

    var rainData = (function() { // 雨量情報
      var hash = {}
      var data = csvToArray(
        $.ajax({
          url: BASE_URL+'Rain/' + date + '/' + time + '.csv',
          async: false,
          error: function() {
            clearInterval(timer);
          }
        }).responseText);
      $.each(data, function(i, val) {
        hash[val.point_id] = val;
      });
      return hash;
    })();

    map.selectAll('.rain-point')
      .datum(function(d) { // 雨量観測局データに雨量をマージする
        d.values = rainData[d.point_id] || {}
        return d;
      })
      .select('circle')
        .style({
          stroke: '#000',
          fill: function(d) {
            var rain = d.values[datatype];
            if (rain === undefined
                || rain == 0
                || rain == '-1111111111'
                || rain == '9999') {
              return '#fff';
            } else {
              rain = Math.max(0, Math.floor(255 - rain * 2));
              return 'rgb(' + rain + ',' + rain + ',255)';
            }
          }
        });
  };


  var datatype;
  $('select[name=datatype]').change(function() {
    datatype = $(this).val();
  }).change();


  var $date = $(':input[name=date]'),
      $time = $(':input[name=time]');

  $date.initialValue = $date.val();
  $time.initialValue = $time.val();

  var getDatetime = function() {
    var date = $date.val() || $date.initialValue;
    var time = $time.val() || $time.initialValue;
    $date.val(date);
    time = time.substring(0, 4) + '0';
    $time.val(time);
    return [ date, time ];
  }

  $(':input[name=load]').click(function(event) {
    event.preventDefault();
    loadRainData();
  });

  var timer;

  $(':input[name=play]').click(function(event) {
    event.preventDefault();
    $('.player').toggle('hidden');

    timer = setInterval(function() {
      var datetime = new Date(getDatetime().join(' '))
      datetime.setMinutes(datetime.getMinutes() + 10);
      $date.val(formatDate(datetime));
      $time.val(datetime.toTimeString().substring(0,5));
      loadRainData();
    }, 500);
  });

  $(':input[name=stop]').click(function(event) {
    event.preventDefault();
    clearInterval(timer);
    $('.player').toggle('hidden');
  });
});

// 簡易版CSV→Array変換
// １行目はヘッダ
function csvToArray(csv) {
  var array = new Array();

  var lines = csv.split('\n');
  var headers = lines[0].split(',');
  for (var i = 1; i < lines.length; i++){
    var cols = lines[i].split(',');
    if (cols.length <= 1) continue;
    var json = new Object();
    for (var j = 0; j < cols.length; j++){
      json[headers[j]] = cols[j];
    }
    array.push(json);
  }

  return array;
}

function formatDate(date) {
  var year = date.getFullYear(),
      month = date.getMonth() + 1,
      day = date.getDate();
  if (month < 10) {
    month = '0' + month;
  }
  if (day < 10) {
    day = '0' + day;
  }
  return year + '-' + month + '-' + day;
}
