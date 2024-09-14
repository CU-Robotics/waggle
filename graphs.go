package main

type GraphableNumber struct {
	FieldName string `json:"fieldName"`
	Value     int    `json:"value"`
}

type Graph struct {
	Data []int
}

type GraphCollection struct {
	Graphs map[string]Graph
}

func (gc *GraphCollection) Init() {
	gc.Graphs = make(map[string]Graph)
}

func (gc *GraphCollection) InsertValue(fieldName string, value int) {
	graph, ok := gc.Graphs["fieldName"]
	if ok {
		graph.Data = append(graph.Data, value)
	} else {
		gc.Graphs[fieldName] = Graph{Data: []int{value}}
	}
}
